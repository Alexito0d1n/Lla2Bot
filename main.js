import { createClient } from '@supabase/supabase-js';
import TelegramBot from 'node-telegram-bot-api';

//supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

//Bot declaration
const botToken = process.env.BOT_TOKEN;
const bot = new TelegramBot(botToken, { polling: true });

//saldo command
bot.onText(/\/saldo/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const name = msg.from.username || msg.from.first_name;
  // DB query
  const { data, error } = await supabase
    .from('users')
    .select('euricoins')
    .eq('telegram_id', telegramId);

  if (error || !data || data.length === 0) {
    bot.sendMessage(chatId, 'No se encontraron tus euricoins. ¿Estás registrado?');
    return;
  }

  const euricoins = data[0].euricoins;
  bot.sendMessage(chatId, ` ${name}, tienes ${euricoins} euricoins.`);
});

//sumar command
bot.onText(/\/sumar (\d+) @(.+)/, async (msg, match) => {
  const adminId = msg.from.id;
  const euricoins = parseInt(match[1]);
  const username = match[2];
  
  //admin check
  const { data: adminData, error: adminError } = await supabase
    .from('users')
    .select('is_admin')
    .eq('telegram_id', adminId);

  if (adminError || !adminData || !adminData[0].is_admin) {
    bot.sendMessage(msg.chat.id, 'Quien cojones eres???');
    return;
  }

  //DB query
  const { data: usuario, error: errorUsuario } = await supabase
    .from('users')
    .select('id, telegram_id, euricoins')
    .eq('name', username);

  if (errorUsuario || !usuario || usuario.length === 0) {
    bot.sendMessage(msg.chat.id, 'No se encontró al usuario.');
    return;
  }

  const usuarioId = usuario[0].id;
  const nuevoPuntaje = usuario[0].euricoins + euricoins;

  const { error: errorUpdate } = await supabase
    .from('users')
    .update({ euricoins: nuevoPuntaje })
    .eq('id', usuarioId);

  if (errorUpdate) {
    bot.sendMessage(msg.chat.id, 'Hubo un error actualizando los euricoins.');
    return;
  }

  //transaction log
  await supabase
    .from('transactions')
    .insert([{ user_id: usuarioId, cantidad: euricoins, administrador_id: adminId }]);

  bot.sendMessage(msg.chat.id, `@${msg.from.username} ha añadido ${euricoins} euricoins a @${username}.`);
});

//restar commadn
// Restar command
bot.onText(/\/restar (\d+) @(.+)/, async (msg, match) => {
    const adminId = msg.from.id;
    const euricoins = parseInt(match[1]);
    const username = match[2];
  
    // Admin check
    const { data: adminData, error: adminError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('telegram_id', adminId);
  
    if (adminError || !adminData || !adminData[0].is_admin) {
      bot.sendMessage(msg.chat.id, 'Quien cojones eres???');
      return;
    }
  
    // DB query
    const { data: usuario, error: errorUsuario } = await supabase
      .from('users')
      .select('id, telegram_id, euricoins')
      .eq('name', username);
  
    if (errorUsuario || !usuario || usuario.length === 0) {
      bot.sendMessage(msg.chat.id, 'No se encontró al usuario');
      return;
    }
  
    const usuarioId = usuario[0].id;
    const saldo = usuario[0].euricoins; // Cambiado de `data` a `usuario`
    const nuevoPuntaje = saldo - euricoins; // Usa `saldo` aquí
  
    // Check saldo
    if (nuevoPuntaje < 0) {
      bot.sendMessage(msg.chat.id, `@${username} es pobre y no puedes quitarle ${euricoins} euricoins porque tiene ${saldo} euricoins`);
      return;
    }
  
    const { error: errorUpdate } = await supabase
      .from('users')
      .update({ euricoins: nuevoPuntaje })
      .eq('id', usuarioId);
  
    if (errorUpdate) {
      bot.sendMessage(msg.chat.id, 'Hubo un error actualizando los euricoins');
      return;
    }
  
    // Transaction log
    await supabase
      .from('transactions')
      .insert([{ user_id: usuarioId, cantidad: -euricoins, administrador_id: adminId }]);
  
    bot.sendMessage(msg.chat.id, `@${msg.from.username} ha expropiado ${euricoins} euricoins a @${username}`);
  });
  
//new user command
bot.onText(/\/registrar/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const name = msg.from.username || msg.from.first_name;
  
    // Verificar si el usuario ya está registrado
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', telegramId);
  
    if (userError) {
      console.error('Error al verificar registro:', userError); // Log del error
      bot.sendMessage(chatId, 'Hubo un error verificando tu registro.');
      return;
    }
  
    if (existingUser && existingUser.length > 0) {
      bot.sendMessage(chatId, 'Ya estás registrado en el sistema.');
      return;
    }
  
    // Registrar al nuevo usuario
    const { error: insertError } = await supabase
      .from('users')
      .insert([{ 
        telegram_id: telegramId, 
        name: name, 
        euricoins: 0,  // Iniciar con 0 euricoins
        is_admin: false  // No es administrador por defecto
      }]);
  
    if (insertError) {
      console.error('Error al registrarse:', insertError); // Log del error
      bot.sendMessage(chatId, 'Hubo un error al registrarte.');
    } else {
      bot.sendMessage(chatId, `¡Bienvenido, ${name}! Te has registrado correctamente.`);
    }
  });
  
//new admin command
bot.onText(/\/new_admin @(.+)/, async (msg, match) => {
  const adminId = msg.from.id;
  const username = match[1];

  //admin check
  const { data: adminData, error: adminError } = await supabase
    .from('users')
    .select('is_admin')
    .eq('telegram_id', adminId);

  if (adminError || !adminData || !adminData[0].is_admin) {
    bot.sendMessage(msg.chat.id, 'Quien cojones eres???');
    return;
  }

  //DB query
  const { data: usuarioData, error: usuarioError } = await supabase
    .from('users')
    .select('id, is_admin')
    .eq('name', username);

  if (usuarioError || !usuarioData || usuarioData.length === 0) {
    bot.sendMessage(msg.chat.id, 'No se encontró al usuario.');
    return;
  }

  //Already admin
  if (usuarioData[0].is_admin) {
    bot.sendMessage(msg.chat.id, `@${username} ya es administrador.`);
    return;
  }

  //admin update: is_admin = true
  const { error: updateError } = await supabase
    .from('users')
    .update({ is_admin: true })
    .eq('id', usuarioData[0].id);

  if (updateError) {
    bot.sendMessage(msg.chat.id, 'Hubo un erroral añadir un nuevo administrador.');
    return;
  }
});


