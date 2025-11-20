use memmap2::Mmap;
use std::fs::File;
use std::path::Path;

pub const GADDAG_MAGIC: &[u8; 8] = b"WDGADDAG";
pub const GADDAG_VERSION: u32 = 1;
pub const NODE_SIZE: usize = 8;
pub const DELIMITER: u8 = 27;

#[repr(C)]
pub struct GaddagHeader {
    pub magic: [u8; 8],
    pub version: u32,
    pub node_count: u32,
    pub root_offset: u32,
    pub letter_mapping: [u8; 26],
    pub _padding: [u8; 2],
}

pub struct Gaddag {
    pub mmap: Mmap,
}

impl Gaddag {
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self, std::io::Error> {
        let file = File::open(path)?;
        let mmap = unsafe { Mmap::map(&file)? };
        
        // Verify magic
        if mmap.len() < 8 || &mmap[0..8] != GADDAG_MAGIC {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Invalid GADDAG magic",
            ));
        }
        
        Ok(Self { mmap })
    }
    
    pub fn root_offset(&self) -> usize {
        let header_size = std::mem::size_of::<GaddagHeader>();
        // Read root offset from header
        let root_bytes = &self.mmap[16..20]; // Offset of root_offset field
        u32::from_le_bytes(root_bytes.try_into().unwrap()) as usize
    }
    
    #[inline(always)]
    pub fn traverse(&self, node_offset: usize, letter: u8) -> Option<usize> {
        if letter == 0 || letter > 27 {
            return None;
        }
        
        if node_offset + NODE_SIZE > self.mmap.len() {
            return None;
        }
        
        let start = node_offset;
        let node = &self.mmap[start..start + NODE_SIZE];
        let edge_mask = u32::from_le_bytes(node[0..4].try_into().unwrap());
        
        // Check if letter exists in edge mask (only for 1-26)
        if letter <= 26 && (edge_mask & (1 << (letter - 1))) == 0 {
            return None;
        }
        
        let _size_flag = edge_mask >> 27;
        
        // Extended node: binary search in edge list
        let ext_offset = u32::from_le_bytes(node[4..8].try_into().unwrap()) as usize;
        let count = (edge_mask >> 27) as usize;
        
        self.binary_search_edge(ext_offset, count, letter)
    }
    
    fn binary_search_edge(&self, offset: usize, count: usize, target_letter: u8) -> Option<usize> {
        let mut low = 0;
        let mut high = count as isize - 1;
        
        while low <= high {
            let mid = (low + high) / 2;
            let entry_offset = offset + (mid as usize * 5); // 5 bytes per entry
            
            if entry_offset + 5 > self.mmap.len() {
                return None;
            }
            
            let letter = self.mmap[entry_offset];
            
            if letter == target_letter {
                let child_offset = u32::from_le_bytes(
                    self.mmap[entry_offset + 1..entry_offset + 5].try_into().unwrap()
                );
                return Some(child_offset as usize);
            } else if letter < target_letter {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        None
    }
    
    pub fn is_terminal(&self, node_offset: usize) -> bool {
        if node_offset + NODE_SIZE > self.mmap.len() {
            return false;
        }
        
        let start = node_offset;
        let node = &self.mmap[start..start + NODE_SIZE];
        let edge_mask = u32::from_le_bytes(node[0..4].try_into().unwrap());
        
        (edge_mask & (1 << 26)) != 0
    }
    
    pub fn is_word_valid(&self, word: &str) -> bool {
        if word.is_empty() { return false; }
        
        let bytes = word.as_bytes();
        let mut node = self.root_offset();
        
        // 1. Traverse first letter
        let first = bytes[0] - b'A' + 1;
        if let Some(next) = self.traverse(node, first) {
            node = next;
        } else {
            return false;
        }
        
        // 2. Traverse Delimiter
        if let Some(next) = self.traverse(node, DELIMITER) {
            node = next;
        } else {
            return false;
        }
        
        // 3. Traverse remaining letters
        for &b in &bytes[1..] {
            let letter = b - b'A' + 1;
            if let Some(next) = self.traverse(node, letter) {
                node = next;
            } else {
                return false;
            }
        }
        
        self.is_terminal(node)
    }
}
