import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os
import time

# ================= الإعدادات =================
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/"
# تأكد من أن البوت "أدمن" في هذه القنوات
REQUIRED_CHANNELS = ["@VaultoUSDT", "@E_G_58"] 
# ============================================

app = Flask('')
@app.route('/')
def home(): return "Bot is Online", 200

def run():
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

# الاتصال بـ Firebase
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
    except Exception as e: print(f"Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- القوائم ---
def main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

def admin_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("📊 Bot Stats", "➕ Add Balance")
    markup.add("🏠 User Mode")
    return markup

# --- فحص الاشتراك (نسخة آمنة لا تسبب توقف) ---
def check_subs(user_id):
    if user_id == ADMIN_ID: return []
    not_joined = []
    for channel in REQUIRED_CHANNELS:
        try:
            status = bot.get_chat_member(channel, user_id).status
            if status in ['left', 'kicked', 'None']:
                not_joined.append(channel)
        except:
            continue # تخطي القناة إذا كان هناك خطأ في الوصول إليها
    return not_joined

# --- الأوامر ---
@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    
    # تسجيل المستخدم في القاعدة
    user_ref = db.reference(f'users/{user_id}')
    if not user_ref.get():
        user_ref.set({'balance': 0.0, 'referrals': 0, 'verified': False})

    missing = check_subs(message.chat.id)
    if missing:
        markup = types.InlineKeyboardMarkup(row_width=1)
        for ch in missing:
            markup.add(types.InlineKeyboardButton(f"📢 Join {ch}", url=f"https://t.me/{ch.replace('@', '')}"))
        markup.add(types.InlineKeyboardButton("✅ Done / Check", callback_data="verify_subs"))
        
        bot.send_message(message.chat.id, "👋 **Welcome!**\n\n🏆 You must join our channels to start.", parse_mode="Markdown", reply_markup=markup)
        return

    # إذا كان مشتركاً
    if message.chat.id == ADMIN_ID:
        bot.send_message(message.chat.id, "💻 Welcome Admin! Use /admin for panel.", reply_markup=admin_menu())
    else:
        bot.send_message(message.chat.id, "✅ Welcome back!", reply_markup=main_menu())

@bot.message_handler(commands=['admin'])
def admin_cmd(message):
    if message.chat.id == ADMIN_ID:
        bot.send_message(message.chat.id, "💻 Admin Dashboard:", reply_markup=admin_menu())

@bot.callback_query_handler(func=lambda call: call.data == "verify_subs")
def verify(call):
    if not check_subs(call.from_user.id):
        bot.answer_callback_query(call.id, "✅ Success!")
        bot.edit_message_text("🎯 Device Verification Required:", call.message.chat.id, call.message.message_id)
        
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton("🛡️ Verify Device", web_app=WebAppInfo(url=WEB_APP_URL)))
        bot.send_message(call.message.chat.id, "Click below to verify and unlock the bot:", reply_markup=markup)
        bot.send_message(call.message.chat.id, "Main Menu:", reply_markup=main_menu())
    else:
        bot.answer_callback_query(call.id, "❌ Join all channels first!", show_alert=True)

@bot.message_handler(func=lambda m: True)
def handle_text(message):
    if message.chat.id == ADMIN_ID:
        if message.text == "📊 Bot Stats":
            total = len(db.reference('users').get() or {})
            bot.send_message(ADMIN_ID, f"📈 Total Users: {total}")
        elif message.text == "🏠 User Mode":
            bot.send_message(ADMIN_ID, "Switched to User Mode", reply_markup=main_menu())
            
    if message.text == "👤 Profile & Balance":
        data = db.reference(f'users/{message.chat.id}').get() or {'balance': 0.0}
        bot.send_message(message.chat.id, f"💰 Your Balance: {data['balance']} USDT")

if __name__ == "__main__":
    Thread(target=run).start()
    while True:
        try:
            bot.polling(none_stop=True, timeout=20)
        except:
            time.sleep(5)
