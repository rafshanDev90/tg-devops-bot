// src/services/whatsappService.js
// Using WhatsApp Business API (free tier) or whatsapp-web.js
import { Client, LocalAuth } from 'whatsapp-web.js';

export class WhatsAppService {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth()
    });
    this.initialize();
  }
  
  initialize() {
    this.client.on('qr', (qr) => {
      console.log('Scan QR to connect WhatsApp:', qr);
      // Send QR to Telegram for scanning
    });
    
    this.client.on('ready', () => {
      console.log('WhatsApp Connected!');
    });
    
    this.client.initialize();
  }
  
  async broadcastToGroups(message, groups) {
    for (const group of groups) {
      await this.client.sendMessage(group, message);
    }
  }
  
  async getGroupMessages(groupId, limit = 50) {
    const chat = await this.client.getChatById(groupId);
    return await chat.fetchMessages({ limit });
  }
}