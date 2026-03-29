import telebot
from telebot import types
import os

# جرب التوكن الخاص بك هنا مباشرة للتأكد
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
bot = telebot.TeleBot(API_TOKEN)

@bot.message_handler(commands=['start'])
def send_welcome(message):
    try:
        # إرسال نص بسيط جداً بدون صور أو تعقيدات
        bot.reply_to(message, "✅ البوت شغال! إذا رأيت هذه الرسالة، فالمشكلة ليست في الاتصال بتليجرام.")
        
        # إظهار زر واحد للتجربة
        markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
        markup.add("اختبار 🔍")
        bot.send_message(message.chat.id, "جرب الضغط على الزر:", reply_markup=markup)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("🚀 البوت بدأ العمل الآن...")
    bot.polling(none_stop=True)
