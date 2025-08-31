export type ChatMessage = {
  id: string;
  content: string;
  user: string;
  role: "user" | "assistant";
  type?: "text" | "file";
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fileData?: string; // base64 encoded file data
};

export type Message =
  | {
      type: "add";
      id: string;
      content: string;
      user: string;
      role: "user" | "assistant";
      messageType?: "text" | "file";
      fileName?: string;
      fileSize?: number;
      fileType?: string;
      fileData?: string;
    }
  | {
      type: "update";
      id: string;
      content: string;
      user: string;
      role: "user" | "assistant";
      messageType?: "text" | "file";
      fileName?: string;
      fileSize?: number;
      fileType?: string;
      fileData?: string;
    }
  | {
      type: "all";
      messages: ChatMessage[];
    };

export const names = [
  "Alice",
  "Bob",
  "Charlie",
  "David",
  "Eve",
  "Frank",
  "Grace",
  "Heidi",
  "Ivan",
  "Judy",
  "Kevin",
  "Linda",
  "Mallory",
  "Nancy",
  "Oscar",
  "Peggy",
  "Quentin",
  "Randy",
  "Steve",
  "Trent",
  "Ursula",
  "Victor",
  "Walter",
  "Xavier",
  "Yvonne",
  "Zoe",
];
