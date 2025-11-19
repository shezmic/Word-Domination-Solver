use axum::{
    extract::ws::{WebSocket, Message, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
    Router,
};
use futures::{stream::StreamExt, SinkExt};
use protocol::{ClientMsg, ServerMsg, AnalysisMode};
use crate::board::Board;
use crate::rack::Rack;
use crate::gaddag::Gaddag;
use crate::search::{search, SearchConfig};
use crate::board_serde::SerializedBoard;
use std::sync::Arc;
use std::time::Duration;
use dashmap::DashMap;

pub fn create_router(gaddag: Arc<Gaddag>) -> Router {
    Router::new()
        .route("/solve", get(move |ws| ws_handler(ws, gaddag.clone())))
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    gaddag: Arc<Gaddag>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, gaddag))
}

async fn handle_socket(socket: WebSocket, gaddag: Arc<Gaddag>) {
    let (mut sender, mut receiver) = socket.split();
    let board_cache: Arc<DashMap<u64, Board>> = Arc::new(DashMap::new());
    
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Binary(data) => {
                match bincode::deserialize::<ClientMsg>(&data) {
                    Ok(client_msg) => {
                        match client_msg {
                            ClientMsg::UpdateBoard { board } => {
                                // Deserialize and store board
                                let deserialized_board = Board::from_serialized(&SerializedBoard {
                                    letters: board.letters,
                                    bonuses: board.bonuses,
                                }, &gaddag);
                                let hash = deserialized_board.hash();
                                board_cache.insert(hash, deserialized_board);
                                
                                let response = ServerMsg::BoardStored { board_hash: hash };
                                if let Ok(response_data) = bincode::serialize(&response) {
                                    let _ = sender.send(Message::Binary(response_data)).await;
                                }
                            }
                            ClientMsg::Analyze { board_hash, rack, mode, time_budget_ms, custom_points } => {
                                // Get board from cache or create empty
                                let board = board_cache
                                    .get(&board_hash)
                                    .map(|b| b.clone())
                                    .unwrap_or_else(|| Board::new());
                                
                                let rack = Rack::from_tiles(rack);
                                
                                let config = SearchConfig {
                                    mode,
                                    confidence_threshold: 100.0,
                                    time_budget_ms,
                                    points: custom_points,
                                    round: 1, // Default to round 1, or get from ClientMsg if available
                                };
                                
                                // Run search (blocking)
                                let result = search(&board, &rack, &gaddag, &config, Duration::from_millis(time_budget_ms));
                                
                                let response = ServerMsg::Result {
                                    moves: result.moves.iter().map(|m| protocol::ScoredMove {
                                        placements: m.placements.clone(),
                                        score: m.score,
                                        word: m.word.clone(),
                                    }).collect(),
                                    confidence: result.confidence,
                                    compute_time_ms: result.compute_time_ms,
                                };
                                
                                if let Ok(response_data) = bincode::serialize(&response) {
                                    let _ = sender.send(Message::Binary(response_data)).await;
                                }
                            }
                            ClientMsg::Cancel => {
                                // TODO: Implement cancellation with tokio::select
                            }
                        }
                    }
                    Err(e) => {
                        let error_msg = ServerMsg::Error(format!("Deserialization error: {}", e));
                        if let Ok(data) = bincode::serialize(&error_msg) {
                            let _ = sender.send(Message::Binary(data)).await;
                        }
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }
}
