# Bincode Encoding Limitation

## Current Status

The frontend currently uses **JSON encoding as a placeholder** for the bincode protocol. This means:

- Messages are sent as JSON strings instead of binary bincode
- The backend **will not understand** these messages
- **WebSocket communication will fail** until this is fixed

## Why This Exists

Proper bincode encoding/decoding in JavaScript requires either:
1. A JS bincode library (not readily available)
2. WASM bindings to Rust's bincode
3. Backend support for JSON protocol

## Solutions

### Option 1: Add JSON Support to Backend (Quickest)

Modify `solver/src/api.rs` to accept both JSON and bincode:

```rust
// Try bincode first, fall back to JSON
match bincode::deserialize::<ClientMsg>(&data) {
    Ok(msg) => handle_message(msg),
    Err(_) => {
        // Try JSON
        match serde_json::from_slice::<ClientMsg>(&data) {
            Ok(msg) => handle_message(msg),
            Err(e) => send_error(e),
        }
    }
}
```

### Option 2: Use Proper Bincode Library (Best)

Find or create a JavaScript bincode implementation:
- https://github.com/bincode-org/bincode (check for JS bindings)
- Or create WASM wrapper around Rust bincode

### Option 3: Text Protocol (Simplest)

Change the entire protocol to use JSON:
- Update `protocol/src/lib.rs` to use `serde_json`
- Change WebSocket to text mode
- Lose some performance but gain simplicity

## Current Workaround

**For testing**, add this to `solver/src/api.rs`:

```rust
Message::Text(text) => {
    match serde_json::from_str::<ClientMsg>(&text) {
        Ok(client_msg) => {
            // Handle as normal
        }
        Err(e) => {
            // Send error
        }
    }
}
```

Then update `frontend/src/store.ts` to use text mode:
```typescript
ws.binaryType = 'text';  // Instead of 'arraybuffer'
```
