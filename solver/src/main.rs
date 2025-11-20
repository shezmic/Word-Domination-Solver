//! Word Domination Solver - Main Server Entry Point
//!
//! A high-performance solver for Word Domination (Scrabble-like game)
//! using GADDAG data structure and beam search algorithm.
//!
//! Version: 0.1.0
//! Status: Stable - Production Ready
//! Last Updated: 2025-01-19

mod constants;
mod board;
mod board_serde;
mod rack;
mod moves;
mod scoring;
mod gaddag;
mod dictionary;
mod booster;
mod movegen;
mod search;
mod api;
#[cfg(test)]
mod search_test;
#[cfg(test)]
mod cross_check_test;
#[cfg(test)]
mod repro_invalid;

use axum::Router;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use tracing_subscriber;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    tracing::info!("Word Domination Solver v0.1.0 - Starting server");
    
    // Try to load GADDAG dictionary from solver directory
    let gaddag = match gaddag::Gaddag::load("dictionary.gaddag") {
        Ok(g) => {
            tracing::info!("Loaded GADDAG dictionary");
            Arc::new(g)
        },
        Err(e) => {
            tracing::warn!("Failed to load GADDAG from solver directory: {}", e);
            tracing::info!("Attempting to load from parent directory");

            match gaddag::Gaddag::load("../dictionary/dictionary.gaddag") {
                Ok(g) => {
                    tracing::info!("Loaded GADDAG dictionary from parent directory");
                    Arc::new(g)
                },
                Err(e2) => {
                    tracing::error!("Failed to load GADDAG: {}", e2);
                    tracing::info!("Attempting to load simple text dictionary");

                    match dictionary::SimpleDictionary::load_from_file("dictionary.txt") {
                        Ok(dict) => {
                            tracing::info!("Loaded {} words from text dictionary", dict.words.len());
                            tracing::error!("Simple dictionary loaded but GADDAG interface required - exiting");
                            return;
                        }
                        Err(e3) => {
                            tracing::error!("Failed to load text dictionary: {}", e3);
                            return;
                        }
                    }
                }
            }
        }
    };
    
    tracing::info!("GADDAG loaded successfully");
    
    // Build router with static file serving
    let app = Router::new()
        // API routes (WebSocket)
        .nest("/api", api::create_router(gaddag))
        // Serve static files from the "static" directory
        .nest_service("/", ServeDir::new("static"))
        .layer(CorsLayer::permissive());
    
    // Start server
    let addr: std::net::SocketAddr = "0.0.0.0:3000".parse().unwrap();
    tracing::info!("Listening on {}", addr);
    tracing::info!("Frontend available at http://localhost:3000");
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
