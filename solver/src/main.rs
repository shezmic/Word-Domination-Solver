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

use axum::Router;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing_subscriber;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    tracing::info!("Word Domination Solver v0.1.0 - Starting server");
    
    // Try to load GADDAG dictionary, fallback to simple dictionary
    let gaddag = match gaddag::Gaddag::load("dictionary/lexicon.gaddag") {
        Ok(g) => {
            tracing::info!("Loaded GADDAG dictionary");
            Arc::new(g)
        },
        Err(e) => {
            tracing::warn!("Failed to load GADDAG: {}", e);
            tracing::info!("Attempting to load simple text dictionary");
            
            match dictionary::SimpleDictionary::load_from_file("dictionary/lexicon.txt") {
                Ok(dict) => {
                    tracing::info!("Loaded {} words from text dictionary", dict.words.len());
                    // Create a minimal GADDAG wrapper for compatibility
                    // For now, we'll proceed without proper GADDAG
                    tracing::error!("Simple dictionary loaded but GADDAG interface required - exiting");
                    return;
                }
                Err(e2) => {
                    tracing::error!("Failed to load text dictionary: {}", e2);
                    return;
                }
            }
        }
    };
    
    tracing::info!("GADDAG loaded successfully");
    
    // Build router
    let app = api::create_router(gaddag)
        .layer(CorsLayer::permissive());
    
    // Start server
    let addr: std::net::SocketAddr = "0.0.0.0:3000".parse().unwrap();
    tracing::info!("Listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
