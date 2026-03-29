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
ADMIN_ID = 1683002116  # معرف حسابك الخاص
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/"
REQUIRED_CHANNELS = ["@VaultoUSDT", "@E_G_58"]

# --- سيرفر Flask لإرضاء Render ---
server = Flask(__name__)
@server.route('/')
def home(): return "Admin System Online", 200

def run_server():
    port = int(os.environ.get("PORT", 10000))
    server.run(host='0.0.0.0', port=port)

# --- الاتصال بـ Firebase ---
try:
    if not firebase_admin._apps:
        # تأكد من رفع ملف serviceAccountKey.json الجديد ليتوقف خطأ RefreshError
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
except Exception as e:
    print(f"Firebase Init Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- وظائف الحالة والتحقق ---
def is_bot_maintenance():
    status = db.reference('settings/maintenance').get()
    return status == True

def is_verified(user_id):
    try:
        data = db.reference(f'users/{user_id}').get()
        return data and data.get('is_verified') == True
    except: return False

# --- لوحات المفاتيح ---
def admin_panel():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("📊 Bot Stats", "➕ Add Points", "➖ Remove Points")
    markup.add("📢 Broadcast", "🛡️ Maintenance Mode")
    markup.add("🏠 Exit Admin Mode")
    return markup

def main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

# --- الأوامر ---
@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    
    # رسالة الصيانة القوية
    if is_bot_maintenance() and message.chat.id != ADMIN_ID:
        maintenance_msg = (
            "⚠️ **SYSTEM OFFLINE**\n\n"
            "The bot is currently under emergency maintenance to fix security issues.\n"
            "Please check back later. Your balance is safe! 🛡️"
        )
        bot.send_message(message.chat.id, maintenance_msg, parse_mode="Markdown")
        return

    user_ref = db.reference(f'users/{user_id}')
    data = user_ref.get()

    if not data:
        user_ref.set({'balance': 0.0, 'referrals': 0, 'is_verified': False, 'joined_at': str(message.date)})
    
    if is_verified(user_id):
        bot.send_message(message.chat.id, "✅ Welcome back!", reply_markup=main_menu())
    else:
        markup = types.InlineKeyboardMarkup(row_width=1)
        for ch in REQUIRED_CHANNELS:
            markup.add(types.InlineKeyboardButton(f"➕ Join {ch}", url=f"https://t.me/{ch.strip('@')}"))
        markup.add(types.InlineKeyboardButton("🛡️ Verify Device", web_app=WebAppInfo(url=WEB_APP_URL)))
        bot.send_message(message.chat.id, "⚠️ **Security Check Required**\nJoin channels and verify to start.", parse_mode="Markdown", reply_markup=markup)

@bot.message_handler(commands=['admin'])
def admin_cmd(message):
    if message.chat.id == ADMIN_ID:
        bot.send_message(message.chat.id, "💻 **Welcome Boss!**\nAdmin panel is ready.", parse_mode="Markdown", reply_markup=admin_panel())

@bot.message_handler(func=lambda m: True)
def handle_all_text(message):
    if is_bot_maintenance() and message.chat.id != ADMIN_ID:
        return

    if message.chat.id == ADMIN_ID:
        if message.text == "📊 Bot Stats":
            users = db.reference('users').get() or {}
            total = len(users)
            verified = sum(1 for u in users.values() if u.get('is_verified'))
            bot.send_message(ADMIN_ID, f"📈 **STATISTICS**\n\n👥 Total Users: {total}\n✅ Verified: {verified}\n🆕 New Joiners logged.", parse_mode="Markdown")
        
        elif message.text == "🛡️ Maintenance Mode":
            current = db.reference('settings/maintenance').get()
            new_status = not current
            db.reference('settings/maintenance').set(new_status)
            status_text = "🔴 STOPPED (Maintenance ON)" if new_status else "🟢 LIVE (Maintenance OFF)"
            bot.send_message(ADMIN_ID, f"System Status: {status_text}")

        elif message.text == "➕ Add Points":
            msg = bot.send_message(ADMIN_ID, "Send: `UserID Amount` (e.g. `1683002116 5`)", parse_mode="Markdown")
            bot.register_next_step_handler(msg, process_add_points)

        elif message.text == "🏠 Exit Admin Mode":
            bot.send_message(ADMIN_ID, "Returning to user view...", reply_markup=main_menu())

    # أوامر المستخدم العادي
    if is_verified(str(message.chat.id)):
        if message.text == "👤 Profile & Balance":
            data = db.reference(f'users/{message.chat.id}').get()
            bot.send_message(message.chat.id, f"💰 **Balance:** {data.get('balance', 0.0)} USDT\n🔗 **Referrals:** {data.get('referrals', 0)}", parse_mode="Markdown")

def process_add_points(message):
    try:
        uid, amt = message.text.split()
        user_ref = db.reference(f'users/{uid}/balance')
        current = user_ref.get() or 0.0
        user_ref.set(current + float(amt))
        bot.send_message(ADMIN_ID, f"✅ Done! Added {amt} to User {uid}")
        bot.send_message(uid, f"🎁 **Admin added {amt} USDT to your balance!**", parse_mode="Markdown")
    except:
        bot.send_message(ADMIN_ID, "❌ Error! Wrong format.")

if __name__ == "__main__":
    Thread(target=run_server).start() # هذا يحل مشكلة الفشل في Render
    print("🚀 Bot with Admin Panel is starting...")
    bot.polling(none_stop=True)
