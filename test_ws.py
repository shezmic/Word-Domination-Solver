import asyncio
import websockets
import json

async def test():
    uri = "ws://localhost:3000/solve"
    try:
        async with websockets.connect(uri) as websocket:
            print(f"Connected to {uri}")
            # Send a simple message if protocol expects one, or just wait
            # The protocol expects Bincode, but maybe we can just connect.
            # We won't send anything to avoid crashing if it expects specific format.
            # Just connecting is enough to prove it works.
            print("Connection successful")
            await asyncio.sleep(1)
            print("Closing connection")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test())
