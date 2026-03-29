import telebot
from telebot import types
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os
import time

# ================= الإعدادات الأساسية =================
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
CHANNELS = ["@VaultoUSDT", "@E_G_58"] # القنوات المطلوب الاشتراك بها
# ===================================================

# تشغيل سيرفر Flask لضمان استمرارية البوت على Render
app = Flask('')
@app.route('/')
def home(): return "Bot is Online!", 200

def run():
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 10000)))

# الاتصال بـ Firebase (مع معالجة الأخطاء لضمان عدم توقف البوت)
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
    print("✅ Connected to Firebase")
except Exception as e:
    print(f"❌ Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- كيبورد المستخدم (عربي كما طلبت) ---
def main_keyboard():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("حسابي 👤", "رابط الإحالة 🔗")
    markup.add("عجلة الحظ 🎡", "المهام 🎯")
    markup.add("إحصائيات 📈", "الدعم الفني 🎧")
    return markup

# --- كيبورد الإدارة ---
def admin_keyboard():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("📊 إحصائيات البوت", "➕ إضافة رصيد")
    markup.add("🏠 وضع المستخدم")
    return markup

# --- فحص الاشتراك الإجباري ---
def is_subscribed(user_id):
    if user_id == ADMIN_ID: return True
    for ch in CHANNELS:
        try:
            status = bot.get_chat_member(ch, user_id).status
            if status in ['left', 'kicked']: return False
        except: continue
    return True

# --- أوامر البوت ---
@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    
    # تسجيل المستخدم في القاعدة
    user_ref = db.reference(f'users/{user_id}')
    if not user_ref.get():
        user_ref.set({'balance': 0.0, 'referrals': 0, 'joined_date': time.ctime()})

    # فحص الاشتراك
    if not is_subscribed(message.chat.id):
        markup = types.InlineKeyboardMarkup(row_width=1)
        for ch in CHANNELS:
            markup.add(types.InlineKeyboardButton(f"📢 اشترك في {ch}", url=f"https://t.me/{ch.replace('@', '')}"))
        markup.add(types.InlineKeyboardButton("✅ تم الاشتراك", callback_data="check_sub"))
        
        bot.send_message(message.chat.id, "⚠️ **عذراً! يجب عليك الاشتراك في القنوات أولاً لاستخدام البوت.**", reply_markup=markup, parse_mode="Markdown")
        return

    # الدخول للبوت
    if message.chat.id == ADMIN_ID:
        bot.send_message(message.chat.id, "💻 أهلاً بك يا مدير! يمكنك التحكم بالبوت الآن.", reply_markup=admin_keyboard())
    else:
        bot.send_message(message.chat.id, "أهلاً بك في Earn Master Bot! 👋", reply_markup=main_keyboard())

@bot.callback_query_handler(func=lambda call: call.data == "check_sub")
def check_callback(call):
    if is_subscribed(call.from_user.id):
        bot.answer_callback_query(call.id, "✅ شكراً لثقتك!")
        bot.delete_message(call.message.chat.id, call.message.message_id)
        bot.send_message(call.message.chat.id, "تم تفعيل البوت بنجاح! 🎉", reply_markup=main_keyboard())
    else:
        bot.answer_callback_query(call.id, "❌ لم تشترك في جميع القنوات بعد!", show_alert=True)

@bot.message_handler(func=lambda m: True)
def handle_all_messages(message):
    user_id = str(message.chat.id)

    # قسم المستخدم
    if message.text == "حسابي 👤":
        data = db.reference(f'users/{user_id}').get() or {'balance': 0}
        bot.send_message(message.chat.id, f"👤 **معلومات حسابك:**\n\n💰 الرصيد: {data['balance']} USDT\n👥 الإحالات: {data.get('referrals', 0)}", parse_mode="Markdown")
    
    elif message.text == "رابط الإحالة 🔗":
        bot.send_message(message.chat.id, f"🔗 **رابط الإحالة الخاص بك:**\n\n`https://t.me/EarnMasterBot?start={user_id}`", parse_mode="Markdown")

    elif message.text == "عجلة الحظ 🎡":
        bot.send_message(message.chat.id, "🎡 ميزة عجلة الحظ ستكون متاحة قريباً في التحديث القادم!")

    # قسم الإدارة
    if message.chat.id == ADMIN_ID:
        if message.text == "📊 إحصائيات البوت":
            users = db.reference('users').get() or {}
            bot.send_message(ADMIN_ID, f"📈 إجمالي عدد المستخدمين: {len(users)}")
        elif message.text == "🏠 وضع المستخدم":
            bot.send_message(ADMIN_ID, "تم التحويل لوضع المستخدم.", reply_markup=main_keyboard())

# --- تشغيل البوت مع نظام الحماية من التوقف ---
if __name__ == "__main__":
    Thread(target=run).start() # تشغيل Flask
    print("🚀 Bot is Polling...")
    while True:
        try:
            bot.polling(none_stop=True, timeout=60)
        except Exception as e:
            print(f"🔄 Restarting due to: {e}")
            time.sleep(5)
