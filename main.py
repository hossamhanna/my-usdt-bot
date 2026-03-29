import telebot
from telebot import types
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os

# --- الإعدادات ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116  # معرف حسابك
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'

# --- سيرفر Flask (لحل مشكلة Port في Render) ---
app = Flask(__name__)
@app.route('/')
def home(): return "Bot is Alive", 200

def run():
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

# --- الاتصال بـ Firebase ---
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
        print("✅ Firebase Connected")
except Exception as e:
    print(f"❌ Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- لوحة مفاتيح المسؤول ---
def admin_keyboard():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("📊 إحصائيات البوت", "🛡️ وضع الصيانة")
    markup.add("➕ إضافة رصيد", "📢 رسالة للكل")
    markup.add("🏠 خروج")
    return markup

# --- لوحة مفاتيح المستخدم ---
def user_keyboard():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 حسابي", "🔗 رابط الإحالة")
    markup.add("🎡 عجلة الحظ", "🎧 الدعم")
    return markup

# --- الأوامر الرئيسية ---
@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    # تسجيل المستخدم تلقائياً
    user_ref = db.reference(f'users/{user_id}')
    if not user_ref.get():
        user_ref.set({'balance': 0.0, 'referrals': 0, 'is_verified': True})
    
    if message.chat.id == ADMIN_ID:
        bot.send_message(message.chat.id, "✅ أهلاً بك يا مدير! استعمل زر /admin لفتح اللوحة.", reply_markup=admin_keyboard())
    else:
        bot.send_message(message.chat.id, "👋 أهلاً بك في Earn Master Bot!", reply_markup=user_keyboard())

@bot.message_handler(commands=['admin'])
def admin_cmd(message):
    if message.chat.id == ADMIN_ID:
        bot.send_message(message.chat.id, "💻 لوحة تحكم الإدارة مفتوحة الآن:", reply_markup=admin_keyboard())
    else:
        bot.send_message(message.chat.id, "⚠️ هذا الأمر للمسؤول فقط.")

# --- معالجة أزرار اللوحة ---
@bot.message_handler(func=lambda m: True)
def handle_text(message):
    if message.chat.id == ADMIN_ID:
        if message.text == "📊 إحصائيات البوت":
            users = db.reference('users').get() or {}
            bot.send_message(ADMIN_ID, f"📈 عدد المستخدمين الحالي: {len(users)}")
        
        elif message.text == "➕ إضافة رصيد":
            msg = bot.send_message(ADMIN_ID, "أرسل ID المستخدم ثم المبلغ (مثال: `1683002116 5`)")
            bot.register_next_step_handler(msg, process_add)
            
        elif message.text == "🏠 خروج":
            bot.send_message(ADMIN_ID, "تم العودة للقائمة العادية.", reply_markup=user_keyboard())

def process_add(message):
    try:
        uid, amt = message.text.split()
        ref = db.reference(f'users/{uid}/balance')
        new_val = (ref.get() or 0.0) + float(amt)
        ref.set(new_val)
        bot.send_message(ADMIN_ID, f"✅ تم إضافة {amt} USDT لليوزر {uid}")
        bot.send_message(uid, f"🎁 أضاف لك المدير {amt} USDT لرصيدك!")
    except:
        bot.send_message(ADMIN_ID, "❌ خطأ! تأكد من كتابة الـ ID ثم مسافة ثم الرقم.")

if __name__ == "__main__":
    Thread(target=run).start()
    print("🚀 Bot is Polling...")
    bot.polling(none_stop=True)
