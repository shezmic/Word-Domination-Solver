use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader, Write};

const GADDAG_MAGIC: &[u8; 8] = b"WDGADDAG";
const GADDAG_VERSION: u32 = 1;

#[derive(Default, Clone)]
struct GaddagNode {
    edges: HashMap<u8, usize>,
    is_terminal: bool,
}

struct GaddagBuilder {
    nodes: Vec<GaddagNode>,
}

impl GaddagBuilder {
    fn new() -> Self {
        let mut builder = Self { nodes: vec![] };
        builder.nodes.push(GaddagNode::default());
        builder
    }
    
    fn insert_word(&mut self, word: &str) {
        if word.is_empty() || word.len() > 9 {
            return;
        }
        
        let bytes: Vec<u8> = word.bytes()
            .map(|b| (b - b'A' + 1) as u8)
            .collect();
        
        // Insert forward path
        let mut current = 0;
        for &letter in &bytes {
            current = self.get_or_create_child(current, letter);
        }
        self.nodes[current].is_terminal = true;
    }
    
    fn get_or_create_child(&mut self, parent: usize, letter: u8) -> usize {
        if let Some(&child) = self.nodes[parent].edges.get(&letter) {
            return child;
        }
        
        let child_idx = self.nodes.len();
        self.nodes.push(GaddagNode::default());
        self.nodes[parent].edges.insert(letter, child_idx);
        child_idx
    }
    
    fn to_bytes(&self) -> Vec<u8> {
        let mut output = Vec::new();
        
        // Write header
        output.extend_from_slice(GADDAG_MAGIC);
        output.extend_from_slice(&GADDAG_VERSION.to_le_bytes());
        output.extend_from_slice(&(self.nodes.len() as u32).to_le_bytes());
        output.extend_from_slice(&(std::mem::size_of::<GaddagHeader>() as u32).to_le_bytes());
        
        // Letter mapping (identity)
        for i in 0..26u8 {
            output.push(i);
        }
        output.push(0);
        output.push(0);
        
        // Write nodes
        for node in &self.nodes {
            let mut edge_mask = 0u32;
            for &letter in node.edges.keys() {
                if letter > 0 && letter <= 26 {
                    edge_mask |= 1 << (letter - 1);
                }
            }
            
            if node.is_terminal {
                edge_mask |= 1 << 26;
            }
            
            output.extend_from_slice(&edge_mask.to_le_bytes());
            
            // Simple offset calculation
            let child_offset = if let Some(&first_child) = node.edges.values().next() {
                *first_child as u32
            } else {
                0
            };
            output.extend_from_slice(&child_offset.to_le_bytes());
        }
        
        output
    }
}

#[repr(C)]
struct GaddagHeader {
    magic: [u8; 8],
    version: u32,
    node_count: u32,
    root_offset: u32,
    letter_mapping: [u8; 26],
    _padding: [u8; 2],
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 {
        eprintln!("Usage: {} <input_lexicon.txt> <output.gaddag>", args[0]);
        std::process::exit(1);
    }
    
    let input_path = &args[1];
    let output_path = &args[2];
    
    println!("Reading lexicon from {}...", input_path);
    let file = File::open(input_path).expect("Cannot open lexicon file");
    let reader = BufReader::new(file);
    
    let mut builder = GaddagBuilder::new();
    let mut word_count = 0;
    
    for line in reader.lines() {
        if let Ok(word) = line {
            let word = word.trim().to_uppercase();
            if word.len() >= 2 && word.len() <= 9 && word.chars().all(|c| c.is_ascii_alphabetic()) {
                builder.insert_word(&word);
                word_count += 1;
            }
        }
    }
    
    println!("Inserted {} words", word_count);
    println!("GADDAG has {} nodes", builder.nodes.len());
    
    let bytes = builder.to_bytes();
    println!("Writing {} bytes to {}...", bytes.len(), output_path);
    
    let mut output_file = File::create(output_path).expect("Cannot create output file");
    output_file.write_all(&bytes).expect("Failed to write GADDAG");
    
    println!("Done!");
}
