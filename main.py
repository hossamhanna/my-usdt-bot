import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db

# --- الإعدادات ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116  # الآيدي الخاص بك
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/"
BOT_LOGO_URL = "https://i.ibb.co/LzNfDqL/logo.jpg" # رابط صورتك

# تهيئة Firebase
if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})

bot = telebot.TeleBot(API_TOKEN)

# --- لوحات المفاتيح (مثل الصور) ---
def main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

def admin_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("📊 Total Users", "💰 Edit Balance")
    markup.add("📢 Broadcast", "🏠 Back to User Menu")
    return markup

# --- أوامر الآدمن ---
@bot.message_handler(commands=['admin'])
def admin_panel(message):
    if message.from_user.id == ADMIN_ID:
        bot.send_message(message.chat.id, "Welcome BOSS! Admin Panel:", reply_markup=admin_menu())

@bot.message_handler(func=lambda m: m.text == "📊 Total Users")
def total_users(message):
    if message.from_user.id == ADMIN_ID:
        users = db.reference('users').get()
        count = len(users) if users else 0
        bot.send_message(message.chat.id, f"Total Registered Users: {count}")

@bot.message_handler(func=lambda m: m.text == "💰 Edit Balance")
def edit_balance_start(message):
    if message.from_user.id == ADMIN_ID:
        msg = bot.send_message(message.chat.id, "Send ID:Amount (e.g., 1683002116:10):")
        bot.register_next_step_handler(msg, process_balance)

def process_balance(message):
    try:
        user_id, amount = message.text.split(':')
        db.reference(f'users/{user_id}').update({'balance': float(amount)})
        bot.send_message(message.chat.id, "✅ Done! Balance updated.")
    except:
        bot.send_message(message.chat.id, "❌ Error! Use format ID:Amount")

# --- أوامر المستخدم (Start & Menu) ---
@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    # تسجيل المستخدم
    if not db.reference(f'users/{user_id}').get():
        db.reference(f'users/{user_id}').set({'balance': 0.0, 'referrals': 0})

    # رسالة الاشتراك الإجباري
    markup = types.InlineKeyboardMarkup(row_width=1)
    markup.add(types.InlineKeyboardButton("📢 Join Channel", url="https://t.me/YourChannel"))
    markup.add(types.InlineKeyboardButton("✅ Done / Check", callback_data="verify_done"))
    
    caption = "👋 **Welcome!**\n\n🏆 Join our channel first to start earning.\n🤝 Then click 'Done' below."
    try:
        bot.send_photo(message.chat.id, BOT_LOGO_URL, caption=caption, parse_mode="Markdown", reply_markup=markup)
    except:
        bot.send_message(message.chat.id, caption, parse_mode="Markdown", reply_markup=markup)

@bot.callback_query_handler(func=lambda call: call.data == "verify_done")
def verify_done(call):
    markup = types.InlineKeyboardMarkup()
    markup.add(types.InlineKeyboardButton("🛡️ Device Verification", web_app=WebAppInfo(url=WEB_APP_URL)))
    bot.send_message(call.message.chat.id, "✅ Channels Joined! Now verify device:", reply_markup=markup)
    bot.send_message(call.message.chat.id, "Main Menu Unlocked:", reply_markup=main_menu())

@bot.message_handler(func=lambda m: m.text == "👤 Profile & Balance")
def profile(message):
    data = db.reference(f'users/{message.chat.id}').get() or {'balance': 0.0}
    bot.send_message(message.chat.id, f"👤 **Profile**\n\n💰 Balance: {data['balance']} USDT")

@bot.message_handler(func=lambda m: m.text == "🏠 Back to User Menu")
def back_home(message):
    bot.send_message(message.chat.id, "Returning...", reply_markup=main_menu())

if __name__ == "__main__":
    print("Bot is running perfectly...")
    bot.polling(none_stop=True)
