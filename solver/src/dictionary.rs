use std::collections::HashSet;
use std::fs;
use std::path::Path;

pub struct SimpleDictionary {
    pub words: HashSet<String>,
}

impl SimpleDictionary {
    pub fn new() -> Self {
        Self {
            words: HashSet::new(),
        }
    }
    
    pub fn len(&self) -> usize {
        self.words.len()
    }
    
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self, std::io::Error> {
        let content = fs::read_to_string(path)?;
        let words: HashSet<String> = content
            .lines()
            .map(|line| line.trim().to_uppercase())
            .filter(|line| !line.is_empty())
            .collect();
        
        Ok(Self { words })
    }
    
    pub fn is_word_valid(&self, word: &str) -> bool {
        self.words.contains(&word.to_uppercase())
    }
    
    pub fn add_word(&mut self, word: String) {
        self.words.insert(word.to_uppercase());
    }
}

impl Default for SimpleDictionary {
    fn default() -> Self {
        Self::new()
    }
}
