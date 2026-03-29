import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os
import time

# ================= الإعدادات الشخصية =================
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/"
BOT_LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg"

# قنوات الاشتراك الإجباري (يجب أن يكون البوت مشرفاً فيها)
REQUIRED_CHANNELS = ["@VaultoUSDT", "@E_G_58"] 
# ===================================================

app = Flask('')
@app.route('/')
def home(): return "Bot status: Active", 200

def run():
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

def keep_alive():
    t = Thread(target=run)
    t.daemon = True
    t.start()

# الاتصال بـ Firebase
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
    except Exception as e: print(f"Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- القوائم (UI) ---
def main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

def admin_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("📊 إحصائيات عامة", "➕ إضافة رصيد")
    markup.add("📢 إرسال إعلان", "🏠 قائمة المستخدم")
    return markup

# --- دالة فحص الاشتراك الإجباري ---
def check_subscriptions(user_id):
    if user_id == ADMIN_ID: return [] # المدير مستثنى
    not_joined = []
    for channel in REQUIRED_CHANNELS:
        try:
            member = bot.get_chat_member(channel, user_id)
            if member.status in ['left', 'kicked']:
                not_joined.append(channel)
        except:
            # إذا فشل البوت في الوصول (ليس أدمن) سيسمح بالمرور لتجنب التعليق
            continue 
    return not_joined

# --- الأوامر ---
@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    
    # تسجيل المستخدم
    user_ref = db.reference(f'users/{user_id}')
    if not user_ref.get():
        user_ref.set({'balance': 0.0, 'referrals': 0, 'verified': False})

    missing = check_subscriptions(message.chat.id)
    if missing:
        markup = types.InlineKeyboardMarkup(row_width=1)
        for ch in missing:
            markup.add(types.InlineKeyboardButton(f"📢 Join {ch}", url=f"https://t.me/{ch.replace('@', '')}"))
        markup.add(types.InlineKeyboardButton("✅ Done / Check", callback_data="verify_subs"))
        
        caption = "👋 **Welcome!**\n🏆 You must join our channels to start."
        bot.send_message(message.chat.id, caption, parse_mode="Markdown", reply_markup=markup)
        return

    if message.chat.id == ADMIN_ID:
        bot.send_message(message.chat.id, "💻 أهلاً بك يا مدير! استخدم /admin للوحة التحكم.", reply_markup=admin_menu())
    else:
        bot.send_message(message.chat.id, "🎯 Welcome back!", reply_markup=main_menu())

@bot.message_handler(commands=['admin'])
def admin_panel(message):
    if message.chat.id == ADMIN_ID:
        bot.send_message(message.chat.id, "💻 لوحة تحكم الإدارة:", reply_markup=admin_menu())

# --- معالجة الأزرار ---
@bot.callback_query_handler(func=lambda call: call.data == "verify_subs")
def verify_callback(call):
    if not check_subscriptions(call.from_user.id):
        bot.delete_message(call.message.chat.id, call.message.message_id)
        bot.send_message(call.message.chat.id, "✅ Done! Now verify your device:", 
                         reply_markup=types.InlineKeyboardMarkup().add(types.InlineKeyboardButton("🛡️ Verify Device", web_app=WebAppInfo(url=WEB_APP_URL))))
        bot.send_message(call.message.chat.id, "Unlocked Menu:", reply_markup=main_menu())
    else:
        bot.answer_callback_query(call.id, "❌ You haven't joined all channels yet!", show_alert=True)

@bot.message_handler(func=lambda m: True)
def handle_all(message):
    # حماية: منع أي ضغط على الأزرار بدون اشتراك
    if check_subscriptions(message.chat.id):
        bot.send_message(message.chat.id, "⚠️ يرجى الاشتراك في القنوات أولاً!")
        return

    # وظائف الأدمن
    if message.chat.id == ADMIN_ID:
        if message.text == "📊 إحصائيات عامة":
            total = len(db.reference('users').get() or {})
            bot.send_message(ADMIN_ID, f"📈 إجمالي المستخدمين: {total}")
        elif message.text == "➕ إضافة رصيد":
            msg = bot.send_message(ADMIN_ID, "أرسل: `ID المبلغ` (مثال: `1683002116 10`)")
            bot.register_next_step_handler(msg, process_add_points)
        elif message.text == "🏠 قائمة المستخدم":
            bot.send_message(ADMIN_ID, "وضع المستخدم:", reply_markup=main_menu())

    # وظائف المستخدم
    if message.text == "👤 Profile & Balance":
        data = db.reference(f'users/{message.chat.id}').get() or {'balance': 0.0}
        bot.send_message(message.chat.id, f"💰 Your Balance: {data['balance']} USDT")

def process_add_points(message):
    try:
        uid, amt = message.text.split()
        ref = db.reference(f'users/{uid}/balance')
        ref.set((ref.get() or 0.0) + float(amt))
        bot.send_message(ADMIN_ID, "✅ Done!")
    except: bot.send_message(ADMIN_ID, "❌ Format error!")

if __name__ == "__main__":
    keep_alive()
    while True:
        try: bot.polling(none_stop=True)
        except: time.sleep(5)
