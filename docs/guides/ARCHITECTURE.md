# Journal Architecture - Using Message System

## Message System

All operations flow through VISITOR/Message architecture:

```typescript
// Every operation is a Message
interface Message {
    command: string,
    payload: {
        content: string | object,
        num: RegisteredNum  // Validated against REGISTERED_NUM_MAP
    }
}
```

## Registered Operations

[types/types.ts](types/types.ts):
```typescript
REGISTERED_NUM_MAP = {
    "init": { val: 0 },
    "get_text": { val: 1 },
    "create_post": { val: 10 },
    "get_posts": { val: 11 },
    "delete_post": { val: 14 },
    "auth_signup": { val: 20 },
    "auth_login": { val: 21 },
}
```

## Message Flow

```
Frontend → Message Creator → sendMessage() → Backend Handler → DynamoDB
```

### Example: Create Post

1. **Frontend** ([journal.js](frontend/src/journal.js)):
   ```javascript
   await createPost("My Title", "Content", "happy");
   ```

2. **API Client** ([api.js](frontend/src/api.js)):
   ```javascript
   const message = createPostMessage(title, content, mood);
   // Creates: { command: "create_post", payload: { content: {...}, num: {val: 10} }}
   sendMessage(message);  // POST to /msg
   ```

3. **Backend** ([server.js](backend/server.js)):
   ```javascript
   handleMessage(message, userId) {
     switch (message.command) {
       case 'create_post':
         return await createEntry(userId, message.payload.content);
     }
   }
   ```

4. **Database** ([db.js](backend/db.js)):
   ```javascript
   createEntry(userId, entry) → DynamoDB
   ```

## Admin Actions

As admin, you send messages for:
- `create_post` - Write new post
- `get_posts` - View all posts
- `update_post` - Edit post (TODO)
- `delete_post` - Remove post

All validated through REGISTERED_NUM_MAP system.

## Single Endpoint

Backend has ONE endpoint: `POST /msg`

All operations route through message command validation.

## Next Steps

1. Add more message types to REGISTERED_NUM_MAP as needed
2. Implement update_post handler
3. Add visibility/draft status to posts
