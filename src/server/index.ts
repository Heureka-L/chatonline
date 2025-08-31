import {
  type Connection,
  Server,
  type WSMessage,
  routePartykitRequest,
} from "partyserver";

import type { ChatMessage, Message } from "../shared";

export class Chat extends Server<Env> {
  static options = { hibernate: true };

  messages = [] as ChatMessage[];

  broadcastMessage(message: Message, exclude?: string[]) {
    this.broadcast(JSON.stringify(message), exclude);
  }

  onStart() {
    // this is where you can initialize things that need to be done before the server starts
    // for example, load previous messages from a database or a service

    // create the messages table if it doesn't exist
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, 
        user TEXT, 
        role TEXT, 
        content TEXT,
        type TEXT DEFAULT 'text',
        fileName TEXT,
        fileSize INTEGER,
        fileType TEXT,
        fileData TEXT
      )`
    );

    // 检查表结构并升级（向后兼容）
    try {
      // 尝试查询新结构
      this.messages = this.ctx.storage.sql
        .exec(`SELECT id, user, role, content, type, fileName, fileSize, fileType, fileData FROM messages`)
        .toArray() as ChatMessage[];
    } catch (error) {
      // 如果表存在但缺少新列，添加新列
      this.ctx.storage.sql.exec(`ALTER TABLE messages ADD COLUMN type TEXT DEFAULT 'text'`);
      this.ctx.storage.sql.exec(`ALTER TABLE messages ADD COLUMN fileName TEXT`);
      this.ctx.storage.sql.exec(`ALTER TABLE messages ADD COLUMN fileSize INTEGER`);
      this.ctx.storage.sql.exec(`ALTER TABLE messages ADD COLUMN fileType TEXT`);
      this.ctx.storage.sql.exec(`ALTER TABLE messages ADD COLUMN fileData TEXT`);
      
      // 重新加载消息
      this.messages = this.ctx.storage.sql
        .exec(`SELECT id, user, role, content, type, fileName, fileSize, fileType, fileData FROM messages`)
        .toArray() as ChatMessage[];
    }
  }

  onConnect(connection: Connection) {
    connection.send(
      JSON.stringify({
        type: "all",
        messages: this.messages,
      } satisfies Message),
    );
  }

  saveMessage(message: ChatMessage) {
    // check if the message already exists
    const existingMessage = this.messages.find((m) => m.id === message.id);
    if (existingMessage) {
      this.messages = this.messages.map((m) => {
        if (m.id === message.id) {
          return message;
        }
        return m;
      });
    } else {
      this.messages.push(message);
    }

    // 更新数据库结构以支持文件消息
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, 
        user TEXT, 
        role TEXT, 
        content TEXT,
        type TEXT DEFAULT 'text',
        fileName TEXT,
        fileSize INTEGER,
        fileType TEXT,
        fileData TEXT
      )`
    );

    this.ctx.storage.sql.exec(
      `INSERT INTO messages (id, user, role, content, type, fileName, fileSize, fileType, fileData) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
       ON CONFLICT (id) DO UPDATE SET 
         content = EXCLUDED.content,
         type = EXCLUDED.type,
         fileName = EXCLUDED.fileName,
         fileSize = EXCLUDED.fileSize,
         fileType = EXCLUDED.fileType,
         fileData = EXCLUDED.fileData`,
      [
        message.id,
        message.user,
        message.role,
        message.content,
        message.type || 'text',
        message.fileName || null,
        message.fileSize || null,
        message.fileType || null,
        message.fileData || null
      ]
    );
  }

  onMessage(connection: Connection, message: WSMessage) {
    // let's broadcast the raw message to everyone else
    this.broadcast(message);

    // let's update our local messages store
    const parsed = JSON.parse(message as string) as Message;
    if (parsed.type === "add" || parsed.type === "update") {
      this.saveMessage(parsed);
    }
  }
}

export default {
  async fetch(request, env) {
    return (
      (await routePartykitRequest(request, { ...env })) ||
      env.ASSETS.fetch(request)
    );
  },
} satisfies ExportedHandler<Env>;
