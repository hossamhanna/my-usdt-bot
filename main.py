import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os

# --- الإعدادات الشخصية ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/"
BOT_LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg"

# القنوات التي طلبتها
REQUIRED_CHANNELS = ["@VaultoUSDT", "@E_G_58"] 
# -------------------------

# نظام إبقاء البوت حياً (Flask)
app = Flask('')
@app.route('/')
def home(): return "Bot is Online!"
def run(): app.run(host='0.0.0.0', port=8080)
def keep_alive():
    t = Thread(target=run)
    t.daemon = True
    t.start()

# اتصال Firebase
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
    except: pass

bot = telebot.TeleBot(API_TOKEN)

# دالة القائمة الرئيسية
def main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

# دالة التحقق من القنوات
def check_join(user_id):
    missing = []
    for ch in REQUIRED_CHANNELS:
        try:
            status = bot.get_chat_member(ch, user_id).status
            if status in ['left', 'kicked']:
                missing.append(ch)
        except:
            missing.append(ch)
    return missing

@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    # تسجيل في القاعدة
    try:
        if not db.reference(f'users/{user_id}').get():
            db.reference(f'users/{user_id}').set({'balance': 0.0, 'referrals': 0})
    except: pass

    markup = types.InlineKeyboardMarkup(row_width=1)
    for ch in REQUIRED_CHANNELS:
        markup.add(types.InlineKeyboardButton(f"➕ Join Channel {ch}", url=f"https://t.me/{ch.strip('@')}"))
    markup.add(types.InlineKeyboardButton("✅ I Have Joined / Done", callback_data="verify_now"))
    
    # رسالة الترحيب مثل الصورة
    welcome_text = (
        "👋 **Welcome to Vaulto USDT Bot!**\n\n"
        "🏆 **Start earning USDT by completing simple tasks.**\n\n"
        "⚠️ **Note:** You must join our official channels to unlock the bot features and withdrawals."
    )
    
    try:
        bot.send_photo(message.chat.id, BOT_LOGO_URL, caption=welcome_text, parse_mode="Markdown", reply_markup=markup)
    except:
        bot.send_message(message.chat.id, welcome_text, parse_mode="Markdown", reply_markup=markup)

@bot.callback_query_handler(func=lambda call: call.data == "verify_now")
def verify(call):
    missing = check_join(call.from_user.id)
    if not missing:
        # إذا اشترك في الكل
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton("🛡️ Device Verification", web_app=WebAppInfo(url=WEB_APP_URL)))
        
        bot.send_message(call.message.chat.id, "✅ **Verification Successful!**\n\nNow please complete the final device security check to start earning:", reply_markup=markup, parse_mode="Markdown")
        bot.send_message(call.message.chat.id, "🏠 **Main Menu Unlocked**", reply_markup=main_menu())
    else:
        # إذا نسي قنوات
        list_ch = "\n".join(missing)
        bot.answer_callback_query(call.id, f"⚠️ You didn't join: {list_ch}", show_alert=True)

if __name__ == "__main__":
    keep_alive()
    bot.polling(none_stop=True)
