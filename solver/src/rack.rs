use crate::constants::*;
use crate::board::TileBag;
use rand::Rng;

#[derive(Clone, Debug)]
pub struct Rack {
    pub tiles: Vec<u8>,
}

impl Rack {
    pub fn new() -> Self {
        Self {
            tiles: Vec::with_capacity(7),
        }
    }
    
    pub fn from_tiles(tiles: Vec<u8>) -> Self {
        Self { tiles }
    }
    
    pub fn add_tile(&mut self, tile: u8) -> bool {
        // Try to fill an empty slot (0) first
        if let Some(slot) = self.tiles.iter_mut().find(|&&mut t| t == 0) {
            *slot = tile;
            return true;
        }
        // If no empty slot, push if we want dynamic growth, 
        // but usually rack size is fixed per game. 
        // For now, let's assume we can push if strictly needed, 
        // but standard behavior is filling slots.
        // However, with dynamic rack size, we might just want to push?
        // The original code had fixed slots. 
        // Let's stick to "fill 0s" behavior if we want to maintain size,
        // or "push" if we treat it as a bag.
        // Given the refill logic below, it seems to rely on slots being 0.
        false
    }
    
    pub fn remove_tile(&mut self, tile: u8) -> bool {
        if let Some(slot) = self.tiles.iter_mut().find(|&&mut t| t == tile) {
            *slot = 0;
            return true;
        }
        false
    }
    
    pub fn refill<R: Rng>(&mut self, bag: &mut TileBag, rng: &mut R) {
        for slot in &mut self.tiles {
            if *slot == 0 && bag.total > 0 {
                // Draw random tile from bag using CDF for O(log n) sampling
                let idx = rng.gen_range(0..bag.total);
                
                // Binary search in CDF
                let mut low = 0usize;
                let mut high = 26usize;
                let mut letter = 0u8;
                
                while low <= high {
                    let mid = (low + high) / 2;
                    if mid > 0 && bag.cdf[mid - 1] <= idx && idx < bag.cdf[mid] {
                        letter = mid as u8;
                        break;
                    } else if idx < bag.cdf[mid] {
                        high = mid.saturating_sub(1);
                    } else {
                        low = mid + 1;
                    }
                }
                
                if bag.draw(letter) {
                    *slot = letter;
                }
            }
        }
    }
    
    pub fn count(&self) -> usize {
        self.tiles.iter().filter(|&&t| t != 0).count()
    }
    
    pub fn is_empty(&self) -> bool {
        self.tiles.iter().all(|&t| t == 0)
    }
}

impl Default for Rack {
    fn default() -> Self {
        Self::new()
    }
}
