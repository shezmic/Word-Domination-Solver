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
        
        let size_flag = edge_mask >> 27;
        
        // Fast path: direct child offset calculation (only if not extended)
        if size_flag != 0x1F {
             // This path is only valid if we implemented the contiguous array optimization.
             // Since the compiler currently forces extended nodes (0x1F), this branch 
             // won't be taken for now, but we keep the structure for future optimization.
            let child_offset = u32::from_le_bytes(node[4..8].try_into().unwrap());
            return Some(child_offset as usize + ((letter - 1) as usize * 4)); // Assuming 4-byte offsets
        }
        
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
        // This is tricky with GADDAG.
        // GADDAG stores: Rev(Prefix) + Delim + Suffix.
        // To check "CARE", we can check path: C -> Delim -> A -> R -> E ?
        // No, "CARE" is stored as:
        // C -> Delim -> A -> R -> E
        // A -> C -> Delim -> R -> E
        // ...
        // So checking "CARE" means checking if C -> Delim -> A -> R -> E exists?
        // Yes, that is one valid path representing the word.
        //
        // So `is_word_valid` can just check: Word[0] -> Delim -> Word[1..] ?
        // No, strictly speaking:
        // Word "CARE".
        // Anchor C.
        // Path: C -> Delim -> A -> R -> E.
        // Wait, "CARE" with anchor C (index 0).
        // Prefix is empty.
        // Path: C -> (Rev Prefix) -> Delim -> (Suffix A R E)
        // C -> Delim -> A -> R -> E.
        //
        // So yes, `traverse(root, 'C') -> traverse(..., DELIM) -> traverse(..., 'A') ...`
        
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
