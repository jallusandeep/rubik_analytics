import logging
import asyncio
import re
import os
import time
from datetime import datetime, timedelta, timezone
from telethon import TelegramClient, events
from telethon.sessions import StringSession

from .db import insert_message, get_last_msg_id

def ist_converter(*args):
    # UTC + 5:30
    return (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).timetuple()

logging.Formatter.converter = ist_converter

logger = logging.getLogger("telegram_listener.core")

# URL Regex for fallback extraction
URL_REGEX = r'(https?://\S+)'

class TelegramListener:
    def __init__(self, config):
        # Setup File Logging with UTF-8 encoding to handle emoji and Unicode
        file_handler = logging.FileHandler("listener_turbo.log", encoding='utf-8')
        file_handler.setFormatter(logging.Formatter('%(asctime)s - %(message)s'))
        logger.addHandler(file_handler)
        logger.setLevel(logging.INFO)
        
        # Suppress Telethon's noisy disconnection logs
        logging.getLogger('telethon').setLevel(logging.WARNING)

        self.api_id = config['api_id']
        self.api_hash = config['api_hash']
        self.session_string = config['session_string']
        self.channels = config['channels'] # List of int IDs
        self.client = None

    async def _keep_alive_loop(self):
        """Sends a ping to self every 60s to keep connection active."""
        logger.info("[KeepAlive] Task Started.")
        while True:
            try:
                await asyncio.sleep(60)
                me = await self.client.get_me()
                logger.info(f"[KeepAlive] Ping Success ({me.username or me.first_name}).")
            except Exception as e:
                logger.error(f"[KeepAlive] Failed: {e}")

    async def _polling_loop(self):
        """Actively polls channels for new messages every 3 seconds."""
        logger.info("[Polling] Task Started - Checking for new messages every 3 seconds.")
        
        while True:
            try:
                await asyncio.sleep(3)  # Poll every 3 seconds
                
                for channel_id in self.channels:
                    try:
                        # Get the last message ID we've seen for this channel
                        last_id = get_last_msg_id(channel_id)
                        
                        # Convert channel ID to proper format
                        # Telegram channels need -100 prefix
                        channel_id_str = str(channel_id)
                        if not channel_id_str.startswith('-100'):
                            # Add -100 prefix for channels
                            telegram_channel_id = int(f"-100{abs(channel_id)}")
                        else:
                            telegram_channel_id = channel_id
                        
                        # Fetch recent messages (limit to 20)
                        messages = await self.client.get_messages(telegram_channel_id, limit=20)
                        
                        # Filter messages: only from last 10 minutes AND newer than last_id
                        from datetime import datetime, timedelta, timezone
                        ten_minutes_ago = datetime.now(timezone.utc) - timedelta(minutes=10)
                        
                        new_messages = []
                        for msg in messages:
                            # Check if message is within time window and not yet processed
                            if msg.date and msg.date >= ten_minutes_ago and msg.id > last_id:
                                new_messages.append(msg)
                        
                        # Process new messages in chronological order (oldest first)
                        for msg in reversed(new_messages):
                            await self._process_message(msg, channel_id)
                            
                    except Exception as e:
                        error_msg = str(e)
                        # Skip channels that can't be polled (wrong type)
                        if "Invalid object ID" in error_msg or "GetHistoryRequest" in error_msg:
                            # This channel type doesn't support polling, skip silently
                            pass
                        else:
                            logger.error(f"[Polling] Error checking channel {channel_id}: {e}")
                        
            except Exception as e:
                logger.error(f"[Polling] Loop error: {e}")
                await asyncio.sleep(5)

    async def _process_message(self, msg, chat_id):
        """Process a single message and save to database."""
        try:
            safe_text = (msg.message[:20] if msg.message else "").encode('ascii', 'ignore').decode('ascii')
            logger.info(f"Captured msg {msg.id} from {chat_id} (Media: {msg.media is not None})")
            
            # Get the chat object for this message
            chat = await msg.get_chat()
            
            # Use the existing message processing logic
            await self._process_message_direct(msg, chat)
        except Exception as e:
            logger.error(f"Error processing message {msg.id}: {e}")

    async def catch_up(self):
        """Fetches messages missed while the listener was offline."""
        logger.info("[CatchUp] Starting catch-up process for enabled channels...")
        for channel_id in self.channels:
            try:
                chat_id_str = str(channel_id)
                last_db_id = await asyncio.to_thread(get_last_msg_id, chat_id_str)
                
                logger.info(f"[CatchUp] Channel {chat_id_str}: Last ID in DB is {last_db_id}")
                
                # Fetch entity (Try with -100 prefix first as most are channels)
                try:
                    entity = await self.client.get_entity(int(f"-100{channel_id}"))
                except:
                    entity = await self.client.get_entity(channel_id)
                
                count = 0
                limit = None if last_db_id > 0 else 50
                # Limit catch-up to the last 2 hours to avoid excessive history dump
                cutoff_2h = datetime.now(timezone.utc) - timedelta(hours=2)
                
                async for msg in self.client.iter_messages(
                    channel_id, 
                    min_id=last_db_id, 
                    limit=limit, 
                    reverse=True,
                    offset_date=cutoff_2h
                ):
                    await self._process_message_direct(msg, entity)
                    count += 1
                
                if count > 0:
                    logger.info(f"[CatchUp] Channel {getattr(entity, 'title', chat_id_str)}: Recovered {count} missed messages.")
                else:
                    logger.info(f"[CatchUp] Channel {getattr(entity, 'title', chat_id_str)}: Already up to date.")
                    
            except Exception as e:
                logger.error(f"[CatchUp] Failed for channel {channel_id}: {e}")

    async def start(self):
        """Starts the Telethon client and event loop."""
        logger.info("Initializing Telegram Client...")
        
        self.client = TelegramClient(
            StringSession(self.session_string),
            self.api_id,
            self.api_hash,
            # Connection settings for stability
            connection_retries=None, # Infinite retries
            retry_delay=5
        )

        await self.client.start()
        
        if not await self.client.is_user_authorized():
            logger.error("Session is invalid or expired.")
            raise Exception("Telegram Session Invalid")
        
        me = await self.client.get_me()
        logger.info(f"Connected as: { me.username or me.first_name }")
        logger.info(f"Listening to {len(self.channels)} channels: {self.channels}")

        # Register Event Handler
        # We listen to incoming messages from the specific channels
        # channels list can be empty if we just want to listen to everything, but requirements said "Subscribe only to ENABLED channels"
        
        # RAW DEBUG HANDLER
        @self.client.on(events.Raw)
        async def raw_handler(update):
            # Only log interesting updates to avoid noise
            type_name = type(update).__name__
            # Skip noise like UpdateChannelMessageViews, UpdateReadHistoryOutbox, etc.
            if type_name in ['UpdateNewChannelMessage', 'UpdateNewMessage', 'UpdateShortMessage']:
                logger.info(f"[TURBO-RAW] Update received: {type_name}")

        @self.client.on(events.NewMessage())
        async def handler(event):
            try:
                # TURBO LOGGING: See EVERYTHING
                # Sanitize text to prevent Unicode encoding errors on Windows console
                safe_text = (event.raw_text[:20] if event.raw_text else "").encode('ascii', 'ignore').decode('ascii')
                logger.info(f"[TURBO] NewMessage Event! ChatID: {event.chat_id} | Text: {safe_text}...")
                
                chat = await event.get_chat()
                chat_id = chat.id
                
                # Debug logging
                # logger.info(f"Incoming msg from {chat_id} ({getattr(chat, 'title', 'NoTitle')})")
                
                # Manual filtering to debug ID mismatch
                # We check raw ID, or with -100 prefix
                # self.channels contains int IDs (e.g. 12345 or 10012345)
                
                # Telethon chat.id for channels is usually positive unique ID.
                # Sometimes we need to check if it matches our list.
                # Let's try flexible matching
                
                # Standardize comparison
                # Robust Channel ID matching
                # Create a set of stringified normalized IDs for comparison
                valid_ids = set()
                for c in self.channels:
                    c_str = str(c)
                    valid_ids.add(c_str)
                    valid_ids.add(c_str.replace("-100", ""))
                    if not c_str.startswith("-100"):
                         valid_ids.add(f"-100{c_str}")

                current_id_str = str(chat_id)
                
                if current_id_str in valid_ids or current_id_str.replace("-100", "") in valid_ids:
                    await self._process_message_direct(event.message, chat)
                else:
                    logger.warning(f"Ignored msg from {chat_id} ({getattr(chat, 'title', 'NoTitle')}) - Not in enabled list.")
                    pass
                    
            except Exception as e:
                logger.error(f"Error processing message: {e}")

        # Start the client and block until disconnected
        
        # Start KeepAlive Task
        logger.info("[Listener] Starting KeepAlive Task...")
        asyncio.create_task(self._keep_alive_loop())
        
        # Polling enabled as backup - events are unreliable
        # Start Polling Task
        logger.info("[Listener] Starting Polling Task (checking every 3 seconds)...")
        asyncio.create_task(self._polling_loop())
        
        logger.info("[Listener] Client started and listening (blocking).")
        
        # Custom Keep-Alive Loop instead of run_until_disconnected
        # run_until_disconnected seems to crash or exit immediately in this setup
        logger.info("[Listener] Entering Custom Loop...")
        try:
            while True:
                await asyncio.sleep(1)
                # We could check self.client.is_connected() here if useful
        except asyncio.CancelledError:
            logger.info("[Listener] Task Cancelled.")
        except Exception as e:
            logger.critical(f"[Listener] CRASHED in Custom Loop: {e}", exc_info=True)
            raise e
        finally:
            logger.info("[Listener] Stopped.")

    async def _process_message_direct(self, msg, chat):
        """Extracts raw data and saves to DB."""
        # Determine Source Handle (username or title)
        source_handle = getattr(chat, 'username', None) or getattr(chat, 'title', 'Unknown')
        
        # Determine Media Type
        media_type = "none"
        has_media = False
        file_id = None
        file_name = None
        
        if msg.photo:
            media_type = "image"
            has_media = True
            # file_id in Telethon is complex, we might store the access_hash or just "present"
            # Requirement: "file_id (if media exists)"
            # Telethon doesn't expose a simple "file_id" like Bot API. 
            # We'll store the media ID if possible, or leave blank if not easily available string.
            # Using msg.id represents the message, but media has its own ID.
            file_id = str(msg.photo.id)
            
        elif msg.video:
            media_type = "video"
            has_media = True
            file_id = str(msg.video.id)
            # Try to get filename
            for checkout in msg.video.attributes:
                if hasattr(checkout, 'file_name'):
                    file_name = checkout.file_name
                    
        elif msg.document:
             # Could be other file types, treat as 'file' or 'media'
             media_type = "document"
             has_media = True
             file_id = str(msg.document.id)
             for checkout in msg.document.attributes:
                if hasattr(checkout, 'file_name'):
                    file_name = checkout.file_name

        if msg.entities:
            for entity in msg.entities:
                pass
                
        # Simple extraction combined from text and caption
        full_text = (msg.message or "") + " " + (msg.text or "")
        
        extracted_urls = re.findall(URL_REGEX, full_text)
        urls_str = ",".join(list(set(extracted_urls))) if extracted_urls else None

        # Download Media if present (Async)
        file_path = None
        if has_media:
            try:
                # Setup Media Dir
                BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
                MEDIA_DIR = os.path.join(BASE_DIR, "data", "News", "media_cache")
                if not os.path.exists(MEDIA_DIR):
                    os.makedirs(MEDIA_DIR, exist_ok=True)

                fname = f"{chat.id}_{msg.id}"
                path = os.path.join(MEDIA_DIR, fname)
                
                saved_path = await msg.download_media(file=path)
                if saved_path:
                     file_path = saved_path
            except Exception as e:
                logger.error(f"Media download failed for msg {msg.id}: {e}")

        # Prepare Data Dict
        data = {
            "telegram_chat_id": str(chat.id),
            "telegram_msg_id": str(msg.id),
            "source_handle": source_handle,
            "message_text": msg.message, # Raw text
            "caption_text": msg.message if has_media else None, # In Telegram, text is caption for media
            "media_type": media_type,
            "has_media": has_media,
            "file_id": file_id,
            "file_name": file_name,
            "file_path": file_path,
            "urls": urls_str,
            "received_at": datetime.now(timezone.utc)
        }
        
        # Insert
        try:
            await asyncio.to_thread(insert_message, data)
            logger.info(f"Captured msg {msg.id} from {source_handle} (Media: {bool(file_path)})")
        except Exception as e:
            logger.error(f"DB Insert Failed: {e}")

