import telebot
from telebot import types
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os

# --- الإعدادات ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116 
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'

# --- سيرفر Flask لضمان استقرار Render ---
app = Flask(__name__)
@app.route('/')
def home(): return "Bot is Online and Connected", 200

def run():
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

# --- الاتصال بـ Firebase ---
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
        print("✅ Firebase Connected Successfully")
except Exception as e:
    print(f"❌ Firebase Connection Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- لوحات المفاتيح ---
def admin_keyboard():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("📊 إحصائيات البوت", "🛡️ وضع الصيانة")
    markup.add("➕ إضافة نقاط", "➖ خصم نقاط")
    markup.add("📢 رسالة للكل", "🏠 خروج")
    return markup

# --- الأوامر ---
@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    # تسجيل المستخدم إذا لم يكن موجوداً
    user_ref = db.reference(f'users/{user_id}')
    if not user_ref.get():
        user_ref.set({'balance': 0.0, 'referrals': 0, 'is_verified': True})
    
    if message.chat.id == ADMIN_ID:
        bot.send_message(message.chat.id, "✅ البوت يعمل والقاعدة متصلة! استعمل /admin لفتح لوحة التحكم.", reply_markup=admin_keyboard())
    else:
        bot.send_message(message.chat.id, "👋 أهلاً بك في البوت! رصيدك الحالي: 0.0 USDT")

@bot.message_handler(commands=['admin'])
def admin_panel(message):
    if message.chat.id == ADMIN_ID:
        bot.send_message(message.chat.id, "💻 لوحة تحكم الأدمن المتقدمة:", reply_markup=admin_keyboard())

@bot.message_handler(func=lambda m: True)
def handle_admin_tools(message):
    if message.chat.id == ADMIN_ID:
        if message.text == "📊 إحصائيات البوت":
            users = db.reference('users').get() or {}
            bot.send_message(ADMIN_ID, f"📈 إجمالي المشتركين: {len(users)}")
        
        elif message.text == "➕ إضافة نقاط":
            msg = bot.send_message(ADMIN_ID, "أرسل ID المستخدم ثم المبلغ (مثال: 1683002116 10)")
            bot.register_next_step_handler(msg, process_add_points)

        elif message.text == "🛡️ وضع الصيانة":
            # هنا يمكنك إضافة كود إيقاف البوت لاحقاً
            bot.send_message(ADMIN_ID, "⚠️ تم تفعيل وضع الطوارئ (تجريبي)")

def process_add_points(message):
    try:
        uid, amt = message.text.split()
        ref = db.reference(f'users/{uid}/balance')
        current = ref.get() or 0.0
        ref.set(current + float(amt))
        bot.send_message(ADMIN_ID, f"✅ تمت إضافة {amt} USDT لليوزر {uid}")
        bot.send_message(uid, f"🎁 تم إضافة {amt} USDT إلى حسابك بواسطة الإدارة!")
    except:
        bot.send_message(ADMIN_ID, "❌ خطأ في التنسيق! استعمل: ID المبلغ")

if __name__ == "__main__":
    Thread(target=run).start()
    bot.polling(none_stop=True)
