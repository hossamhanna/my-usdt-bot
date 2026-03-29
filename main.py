import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os
import datetime

# --- ⚙️ الإعدادات الأساسية ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116  # أنت المدير
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/"
REQUIRED_CHANNELS = ["@VaultoUSDT", "@E_G_58"]

# --- 🌐 نظام Flask لضمان استقرار Render ---
app = Flask(__name__)
@app.route('/')
def home(): return "Bot System is Fully Functional!", 200

def run_flask():
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

# --- 🔥 الاتصال بـ Firebase ---
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
        print("✅ Connected to Firebase successfully")
except Exception as e:
    print(f"❌ Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- 🛡️ دوال الحماية والإدارة ---
def is_maintenance():
    return db.reference('settings/maintenance').get() == True

def is_verified(user_id):
    data = db.reference(f'users/{user_id}').get()
    return data and data.get('is_verified') == True

# --- ⌨️ لوحات المفاتيح (UI/UX) ---
def admin_keyboard():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("📊 إحصائيات البوت كاملة", "🛡️ تشغيل/إيقاف الصيانة")
    markup.add("➕ إضافة رصيد", "➖ خصم رصيد")
    markup.add("📢 إرسال رسالة جماعية", "🚫 حظر مستخدم")
    markup.add("🏠 خروج لوضع المستخدم")
    return markup

def user_keyboard():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 الحساب والرصيد", "🔗 مركز الإحالات")
    markup.add("🎡 عجلة الحظ", "📈 الإحصائيات العامة")
    markup.add("🎯 المهام اليومية", "🎧 الدعم الفني")
    return markup

# --- 🚀 الأوامر الرئيسية ---
@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    
    # رسالة الصيانة القوية
    if is_maintenance() and message.chat.id != ADMIN_ID:
        msg = "⚠️ **نعتذر بشدة!**\nالبوت حالياً متوقف للصيانة الطارئة وتحديث أنظمة الأمان. رصيدك في أمان وسنعود قريباً!"
        bot.send_message(message.chat.id, msg, parse_mode="Markdown")
        return

    # تسجيل بيانات المستخدم الجديد
    user_ref = db.reference(f'users/{user_id}')
    user_data = user_ref.get()
    
    if not user_data:
        user_ref.set({
            'balance': 0.0,
            'referrals': 0,
            'is_verified': False,
            'username': message.from_user.username or "Unknown",
            'joined_date': str(datetime.date.today())
        })

    if is_verified(user_id):
        bot.send_message(message.chat.id, "✅ أهلاً بك في **Earn Master Bot**\nاستخدم الأزرار بالأسفل لبدء الربح!", 
                         reply_markup=user_keyboard(), parse_mode="Markdown")
    else:
        # شاشة القفل والتحقق
        markup = types.InlineKeyboardMarkup(row_width=1)
        for ch in REQUIRED_CHANNELS:
            markup.add(types.InlineKeyboardButton(f"➕ انضمام {ch}", url=f"https://t.me/{ch.strip('@')}"))
        markup.add(types.InlineKeyboardButton("🛡️ التحقق من الجهاز (نظام قوي)", web_app=WebAppInfo(url=WEB_APP_URL)))
        
        bot.send_message(message.chat.id, "⚠️ **تنبيه أمني:**\nيجب التحقق من أنك إنسان ولست حساباً متعدداً للبدء.", 
                         reply_markup=markup, parse_mode="Markdown")

# --- 👑 قسم لوحة الإدارة (للمدير فقط) ---
@bot.message_handler(commands=['admin'])
def open_admin(message):
    if message.chat.id == ADMIN_ID:
        bot.send_message(message.chat.id, "💻 **لوحة تحكم المدير المتقدمة**", reply_markup=admin_keyboard(), parse_mode="Markdown")

@bot.message_handler(func=lambda m: True)
def router(message):
    if is_maintenance() and message.chat.id != ADMIN_ID: return

    # --- إدارة الأدمن ---
    if message.chat.id == ADMIN_ID:
        if message.text == "📊 إحصائيات البوت كاملة":
            users = db.reference('users').get() or {}
            total = len(users)
            v_count = sum(1 for u in users.values() if u.get('is_verified'))
            bot.send_message(ADMIN_ID, f"📈 **تقرير شامل:**\n\n👥 إجمالي المسجلين: {total}\n✅ الحسابات الموثقة: {v_count}\n🔴 حسابات وهمية محتملة: {total - v_count}")

        elif message.text == "🛡️ تشغيل/إيقاف الصيانة":
            current = db.reference('settings/maintenance').get()
            new = not current
            db.reference('settings/maintenance').set(new)
            text = "🔴 البوت متوقف الآن عن الجميع" if new else "🟢 البوت يعمل بشكل طبيعي"
            bot.send_message(ADMIN_ID, text)

        elif message.text == "➕ إضافة رصيد":
            m = bot.send_message(ADMIN_ID, "أرسل: `ID المبلغ` (مثال: `1683002116 5.5`)", parse_mode="Markdown")
            bot.register_next_step_handler(m, process_add)

        elif message.text == "📢 إرسال رسالة جماعية":
            m = bot.send_message(ADMIN_ID, "أرسل نص الرسالة التي تريد إرسالها لكل المستخدمين:")
            bot.register_next_step_handler(m, process_broadcast)

        elif message.text == "🏠 خروج لوضع المستخدم":
            bot.send_message(ADMIN_ID, "تم العودة.", reply_markup=user_keyboard())

    # --- وظائف المستخدم ---
    if is_verified(message.chat.id):
        if message.text == "👤 الحساب والرصيد":
            u = db.reference(f'users/{message.chat.id}').get()
            bot.send_message(message.chat.id, f"👤 **المستخدم:** {u.get('username')}\n💰 **الرصيد:** {u.get('balance')} USDT\n🔗 **الإحالات:** {u.get('referrals')}", parse_mode="Markdown")
        
        elif message.text == "🔗 مركز الإحالات":
            link = f"https://t.me/{(bot.get_me()).username}?start={message.chat.id}"
            bot.send_message(message.chat.id, f"🎁 **اربح عن كل صديق!**\nرابط إحالتك:\n`{link}`", parse_mode="Markdown")

# --- 📁 وظائف المعالجة الخلفية ---
def process_add(message):
    try:
        uid, amt = message.text.split()
        ref = db.reference(f'users/{uid}/balance')
        new = (ref.get() or 0.0) + float(amt)
        ref.set(new)
        bot.send_message(ADMIN_ID, f"✅ تمت إضافة {amt} لـ {uid}")
        bot.send_message(uid, f"🎁 **مبروك! أضاف لك المدير {amt} USDT لرصيدك.**")
    except: bot.send_message(ADMIN_ID, "❌ خطأ في التنسيق.")

def process_broadcast(message):
    users = db.reference('users').get() or {}
    count = 0
    for uid in users:
        try:
            bot.send_message(uid, f"📢 **إعلان من الإدارة:**\n\n{message.text}", parse_mode="Markdown")
            count += 1
        except: continue
    bot.send_message(ADMIN_ID, f"✅ تم إرسال الرسالة إلى {count} مستخدم.")

if __name__ == "__main__":
    Thread(target=run_flask).start()
    print("🚀 The Master Bot is Online!")
    bot.polling(none_stop=True)
