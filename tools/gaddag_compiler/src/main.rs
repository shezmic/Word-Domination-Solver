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
        // Sanity checks
        if word.is_empty() || word.len() > 9 { // 9 is standard WD board size
            return;
        }
        
        // Standardize input (Map A=1, B=2... Delimiter=27)
        let bytes: Vec<u8> = word.bytes()
            .map(|b| (b - b'A' + 1) as u8)
            .collect();
        
        // Insert GADDAG paths for each anchor position
        for anchor in 0..bytes.len() {
            let mut current = 0; // start at root
            
            // 1. INSERT ANCHOR FIRST (Critical Fix)
            current = self.get_or_create_child(current, bytes[anchor]);
            
            // 2. Insert Reversed Prefix (letters BEFORE anchor)
            // Note: We go from anchor-1 down to 0
            for i in (0..anchor).rev() {
                current = self.get_or_create_child(current, bytes[i]);
            }
            
            // 3. Insert Delimiter (Using 27 as standard separator)
            current = self.get_or_create_child(current, 27);
            
            // 4. Insert Suffix (letters AFTER anchor)
            for i in (anchor + 1)..bytes.len() {
                current = self.get_or_create_child(current, bytes[i]);
            }
            
            // 5. Mark as terminal
            self.nodes[current].is_terminal = true;
        }
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
        
        // 1. Calculate Layout Constants
        let header_size = std::mem::size_of::<GaddagHeader>() as u32;
        let node_count = self.nodes.len() as u32;
        let node_size = 8; // 4 bytes mask + 4 bytes offset
        
        // The Edge List section starts immediately after the last node
        let edges_section_start = header_size + (node_count * node_size);
        
        // 2. Prepare Edge Lists (Sorted) & Calculate Offsets
        // We need to know exactly where each node's edge list will be written.
        let mut node_edge_offsets = Vec::with_capacity(self.nodes.len());
        let mut current_edge_offset = edges_section_start;
        
        // We also need to store the sorted edges temporarily so we don't sort twice
        let mut all_sorted_edges: Vec<Vec<CompiledEdge>> = Vec::with_capacity(self.nodes.len());

        for (node_idx, node) in self.nodes.iter().enumerate() {
            // Convert HashMap to Vec and Sort (REQUIRED for Binary Search in Reader)
            let mut sorted_edges: Vec<CompiledEdge> = node.edges.iter()
                .map(|(&l, &idx)| CompiledEdge { letter: l, child_node_index: idx })
                .collect();
            sorted_edges.sort_by_key(|e| e.letter);
            
            // Store the offset where this list will begin
            node_edge_offsets.push(current_edge_offset);
            
            // Advance the offset (each edge is 1 byte letter + 4 bytes offset = 5 bytes)
            current_edge_offset += (sorted_edges.len() as u32) * 5;
            
            all_sorted_edges.push(sorted_edges);
        }

        // 3. Write Header
        output.extend_from_slice(GADDAG_MAGIC);
        output.extend_from_slice(&GADDAG_VERSION.to_le_bytes());
        output.extend_from_slice(&node_count.to_le_bytes());
        // Root is always the first node (index 0), so its offset is just after the header
        let root_offset = header_size; 
        output.extend_from_slice(&root_offset.to_le_bytes()); 

        // Letter mapping (Identity)
        for i in 0..26u8 { output.push(i); }
        output.push(0); output.push(0); // Padding

        // 4. Write Nodes (The Fixed Array)
        for (i, node) in self.nodes.iter().enumerate() {
            let sorted_edges = &all_sorted_edges[i];
            let count = sorted_edges.len() as u32;
            
            // Construct Edge Mask
            // Bits 0-26: Presence of letter
            // Bits 27-31: Child Count
            let mut edge_mask = 0u32;
            
            for edge in sorted_edges {
                if edge.letter >= 1 && edge.letter <= 26 {
                    edge_mask |= 1 << (edge.letter - 1);
                }
            }
            
            if node.is_terminal{
                edge_mask |= 1 << 26; // Bit 26 is terminal flag
            }
            
            // Pack count into top 5 bits
            // Note: We limit count to 31. If a node has > 31 edges (impossible in Scrabble), this breaks.
            edge_mask |= (count & 0x1F) << 27;
            
            output.extend_from_slice(&edge_mask.to_le_bytes());
            
            // Pointer to the Edge List we calculated earlier
            let edge_list_ptr = node_edge_offsets[i];
            output.extend_from_slice(&edge_list_ptr.to_le_bytes());
        }
        
        // 5. Write Edge Lists (The Variable Data)
        for sorted_edges in all_sorted_edges {
            for edge in sorted_edges {
                output.push(edge.letter);
                
                // CRITICAL FIX: Convert Child Index -> Child File Offset
                // The Reader expects a file offset, not an index.
                let child_offset = header_size + (edge.child_node_index as u32 * node_size);
                output.extend_from_slice(&child_offset.to_le_bytes());
            }
        }
        
        output
    }
}

struct CompiledEdge {
    letter: u8,
    child_node_index: usize,
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
        eprintln!("Usage: {} <input_dictionary.txt> <output.gaddag>", args[0]);
        std::process::exit(1);
    }
    
    let input_path = &args[1];
    let output_path = &args[2];
    
    println!("Reading dictionary from {}...", input_path);
    let file = File::open(input_path).expect("Cannot open dictionary file");
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
