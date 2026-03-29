import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os

# --- الإعدادات ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/"
BOT_LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg"

# القنوات المطلوبة (تأكد أن البوت آدمن فيها)
REQUIRED_CHANNELS = ["@YourChannel1"] 

# --- سيرفر Flask (لإبقاء البوت حياً) ---
app = Flask('')
@app.route('/')
def home(): return "Bot is Running!"
def run(): app.run(host='0.0.0.0', port=8080)
def keep_alive():
    Thread(target=run, daemon=True).start()

# --- اتصال Firebase ---
try:
    if not firebase_admin._apps:
        if os.path.exists("serviceAccountKey.json"):
            cred = credentials.Certificate("serviceAccountKey.json")
            firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
            print("✅ Firebase Connected")
        else:
            print("❌ File serviceAccountKey.json missing!")
except Exception as e:
    print(f"❌ Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- القوائم ---
def main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

# --- فحص الاشتراك ---
def is_subscribed(user_id):
    for ch in REQUIRED_CHANNELS:
        try:
            status = bot.get_chat_member(ch, user_id).status
            if status in ['left', 'kicked']: return False
        except: return False
    return True

# --- الأوامر ---
@bot.message_handler(commands=['start'])
def start(message):
    print(f"📩 New Start from: {message.chat.id}") # ستظهر في الـ Logs عند الضغط
    user_id = str(message.chat.id)
    
    markup = types.InlineKeyboardMarkup(row_width=1)
    for ch in REQUIRED_CHANNELS:
        markup.add(types.InlineKeyboardButton(f"📢 Join {ch}", url=f"https://t.me/{ch.strip('@')}"))
    markup.add(types.InlineKeyboardButton("✅ Done / Check", callback_data="check"))
    
    caption = "👋 **Welcome!**\n\n🏆 You must join our channel first to start earning."
    try:
        bot.send_photo(message.chat.id, BOT_LOGO_URL, caption=caption, parse_mode="Markdown", reply_markup=markup)
    except:
        bot.send_message(message.chat.id, caption, parse_mode="Markdown", reply_markup=markup)

@bot.callback_query_handler(func=lambda call: call.data == "check")
def check(call):
    if is_subscribed(call.from_user.id):
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton("🛡️ Verify Device", web_app=WebAppInfo(url=WEB_APP_URL)))
        bot.send_message(call.message.chat.id, "✅ Verified! Now complete device check:", reply_markup=markup)
        bot.send_message(call.message.chat.id, "🏠 Menu Unlocked:", reply_markup=main_menu())
    else:
        bot.answer_callback_query(call.id, "⚠️ Please join all channels first!", show_alert=True)

if __name__ == "__main__":
    keep_alive()
    print("🚀 Bot Polling Started...")
    bot.polling(none_stop=True)
