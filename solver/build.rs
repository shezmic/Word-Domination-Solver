use std::collections::HashMap;
use std::env;
use std::fs::File;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

const GADDAG_MAGIC: &[u8; 8] = b"WDGADDAG";
const GADDAG_VERSION: u32 = 1;

#[derive(Default)]
struct Node {
    edges: HashMap<u8, usize>,
    is_terminal: bool,
}

struct GaddagBuilder {
    nodes: Vec<Node>,
}

impl GaddagBuilder {
    fn new() -> Self {
        Self {
            nodes: vec![Node::default()],
        }
    }

    fn insert(&mut self, word: &str) {
        let chars: Vec<u8> = word.bytes().map(|b| b - b'A' + 1).collect();
        
        for i in 0..chars.len() {
            let mut current_node = 0;
            current_node = self.get_or_create_child(current_node, chars[i]);
            
            for &c in chars.iter().take(i).rev() {
                current_node = self.get_or_create_child(current_node, c);
            }
            
            current_node = self.get_or_create_child(current_node, 27);
            
            for &c in chars.iter().skip(i + 1) {
                current_node = self.get_or_create_child(current_node, c);
            }
            
            self.nodes[current_node].is_terminal = true;
        }
    }

    fn get_or_create_child(&mut self, parent_idx: usize, letter: u8) -> usize {
        if let Some(&child_idx) = self.nodes[parent_idx].edges.get(&letter) {
            return child_idx;
        }
        
        let new_idx = self.nodes.len();
        self.nodes.push(Node::default());
        self.nodes[parent_idx].edges.insert(letter, new_idx);
        new_idx
    }

    fn write_to_file(&self, path: &Path) {
        let mut file = File::create(path).unwrap();
        let mut buffer = Vec::new();
        
        let header_size = 8 + 4 + 4 + 4 + 26 + 2;
        buffer.resize(header_size, 0);
        
        let mut node_offsets = vec![0u32; self.nodes.len()];
        let mut current_offset = header_size as u32;
        
        for (i, _node) in self.nodes.iter().enumerate() {
            node_offsets[i] = current_offset;
            current_offset += 8;
        }
        
        let mut edge_list_offsets = vec![0u32; self.nodes.len()];
        
        for (i, node) in self.nodes.iter().enumerate() {
            edge_list_offsets[i] = current_offset;
            let count = node.edges.len();
            current_offset += (count * 5) as u32;
        }
        
        let mut cursor = std::io::Cursor::new(&mut buffer);
        cursor.write_all(GADDAG_MAGIC).unwrap();
        cursor.write_all(&GADDAG_VERSION.to_le_bytes()).unwrap();
        cursor.write_all(&(self.nodes.len() as u32).to_le_bytes()).unwrap();
        cursor.write_all(&node_offsets[0].to_le_bytes()).unwrap();
        cursor.write_all(&[0u8; 26]).unwrap();
        cursor.write_all(&[0u8; 2]).unwrap();
        
        for (i, node) in self.nodes.iter().enumerate() {
            let mut edge_mask = 0u32;
            for &letter in node.edges.keys() {
                if letter >= 1 && letter <= 26 {
                    edge_mask |= 1 << (letter - 1);
                }
            }
            
            if node.is_terminal {
                edge_mask |= 1 << 26;
            }
            
            let edge_count = node.edges.len().min(31) as u32;
            edge_mask |= edge_count << 27;
            
            cursor.write_all(&edge_mask.to_le_bytes()).unwrap();
            cursor.write_all(&edge_list_offsets[i].to_le_bytes()).unwrap();
        }
        
        for node in &self.nodes {
            let mut edges: Vec<_> = node.edges.iter().collect();
            edges.sort_by_key(|(&k, _)| k);
            
            for (&letter, &child_idx) in edges {
                cursor.write_all(&[letter]).unwrap();
                cursor.write_all(&node_offsets[child_idx].to_le_bytes()).unwrap();
            }
        }
        
        file.write_all(&buffer).unwrap();
    }
}

fn compile_gaddag(input_path: &Path, output_path: &Path) {
    println!("cargo:warning=Compiling GADDAG from {} to {}...", input_path.display(), output_path.display());

    let file = File::open(input_path).expect("Failed to open dictionary file");
    let reader = BufReader::new(file);
    
    let mut builder = GaddagBuilder::new();
    let mut count = 0;

    for line in reader.lines() {
        let word = line.expect("Failed to read line");
        let word = word.trim().to_uppercase();
        if word.is_empty() { continue; }
        
        builder.insert(&word);
        count += 1;
    }
    
    println!("cargo:warning=Processed {} words, writing GADDAG...", count);
    builder.write_to_file(output_path);
    println!("cargo:warning=GADDAG compilation complete!");
}

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let project_root = Path::new(&manifest_dir).parent().unwrap();
    let lexicon_path = project_root.join("dictionary").join("dictionary.txt");
    let gaddag_path = PathBuf::from(&manifest_dir).join("dictionary.gaddag");
    
    println!("cargo:rerun-if-changed={}", lexicon_path.display());
    println!("cargo:rerun-if-changed=build.rs");
    
    let mut needs_rebuild = true;
    if gaddag_path.exists() {
        if let (Ok(lexicon_meta), Ok(gaddag_meta)) = (
            std::fs::metadata(&lexicon_path),
            std::fs::metadata(&gaddag_path)
        ) {
            if let (Ok(lexicon_modified), Ok(gaddag_modified)) = (
                lexicon_meta.modified(),
                gaddag_meta.modified()
            ) {
                if gaddag_modified > lexicon_modified && gaddag_meta.len() > 100 {
                    needs_rebuild = false;
                }
            }
        }
    }
    
    if needs_rebuild {
        compile_gaddag(&lexicon_path, &gaddag_path);
    }
    
    println!("cargo:rustc-env=GADDAG_PATH={}", gaddag_path.display());
}
