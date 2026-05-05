// supabase-client.js
// Supabase client for RAG Techniques

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Validate configuration
if (!SUPABASE_URL || SUPABASE_URL === 'https://your-project.supabase.co') {
    console.error('Error: Please update config.js with your actual Supabase credentials');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// DATA CACHE
// ============================================
let clustersCache = null;
let techniquesCache = null;

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Fetch all clusters
 */
export async function getClusters() {
    if (clustersCache) return clustersCache;
    
    const { data, error } = await supabase
        .from('clusters')
        .select('*')
        .order('name');
    
    if (error) throw error;
    clustersCache = data;
    return data;
}

/**
 * Fetch all techniques with their relationships
 */
export async function getTechniques() {
    if (techniquesCache) return techniquesCache;
    
    // First query: techniques with basic relations
    const { data: techniques, error: err1 } = await supabase
        .from('techniques')
        .select(`
            *,
            clusters!inner(*),
            stages!inner(*),
            problems!inner(*),
            mechanisms!inner(*),
            technique_illustrations(image_path)
        `)
        .order('name');
    
    if (err1) throw err1;
    
    // Second query: relationships separately
    const { data: relationships, error: err2 } = await supabase
        .from('technique_relationships')
        .select(`
            technique_id,
            related_technique_id,
            relationship_type,
            source:technique_id(name),
            target:related_technique_id(name)
        `);
    
    if (err2) throw err2;
    
    // Build a map of technique_id -> relationships
    const relMap = {};
    relationships.forEach(r => {
        if (!relMap[r.technique_id]) relMap[r.technique_id] = [];
        relMap[r.technique_id].push({
            relationship_type: r.relationship_type,
            related_technique: r.target
        });
    });
    
    // Attach relationships to techniques
    techniques.forEach(t => {
        t.technique_relationships = relMap[t.id] || [];
    });
    
    techniquesCache = techniques;
    return techniques;
}

/**
 * Get techniques in legacy format for backward compatibility
 */
export async function getDataInLegacyFormat() {
    const techniques = await getTechniques();
    
    // Build CLUSTERS array
    const clusters = await getClusters();
    const CLUSTERS = clusters.map(c => ({
        id: c.id,
        name: c.name,
        color: c.color,
        desc: c.description
    }));
    
    // Build DATA array
    const DATA = techniques.map(t => ({
        t: t.name,
        c: t.cluster_id,
        p: t.problems.name,
        s: t.stages.name,
        m: t.mechanisms.name,
        sim: t.technique_relationships.map(r => r.related_technique?.name).filter(Boolean)
    }));
    
    // Build DESCRIPTIONS object
    const DESCRIPTIONS = {};
    techniques.forEach(t => {
        if (t.description) {
            DESCRIPTIONS[t.name] = t.description;
        }
    });
    
    // Build TECHNIQUE_IMAGES object
    const TECHNIQUE_IMAGES = {};
    techniques.forEach(t => {
        if (t.technique_illustrations?.length > 0) {
            TECHNIQUE_IMAGES[t.name] = t.technique_illustrations[0].image_path;
        }
    });
    
    return { CLUSTERS, DATA, DESCRIPTIONS, TECHNIQUE_IMAGES };
}

/**
 * Get technique by name
 */
export async function getTechniqueByName(name) {
    const { data, error } = await supabase
        .from('techniques')
        .select(`
            *,
            clusters(*),
            stages(*),
            problems(*),
            mechanisms(*),
            technique_relationships(
                relationship_type,
                related_technique:related_technique_id(
                    name,
                    cluster:cluster_id(name, color),
                    stage:stage_id(name)
                )
            ),
            technique_illustrations(image_path)
        `)
        .eq('name', name)
        .single();
    
    if (error) throw error;
    return data;
}

/**
 * Search techniques
 */
export async function searchTechniques(query) {
    const { data, error } = await supabase
        .from('techniques')
        .select(`
            *,
            clusters!inner(name, color),
            stages!inner(name),
            mechanisms!inner(name)
        `)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .order('name');
    
    if (error) throw error;
    return data;
}

/**
 * Clear cache (useful for refreshing data)
 */
export function clearCache() {
    clustersCache = null;
    techniquesCache = null;
}

// ============================================
// FALLBACK DATA (for offline use)
// ============================================

export const FALLBACK_CLUSTERS = [
    {id:"QT",name:"Query Transformation & Expansion",color:"#2563EB",desc:"Query reformulation, expansion, rewriting, and augmentation techniques"},
    {id:"RC",name:"Routing & Query Classification",color:"#0891B2",desc:"Query routing, logical/semantic classification, conditional pipeline selection"},
    {id:"AG",name:"Agentic & Multi-Agent Systems",color:"#7C3AED",desc:"Autonomous agents, multi-agent collaboration, iterative workflows"},
    {id:"HR",name:"Hybrid & Ensemble Retrieval",color:"#059669",desc:"Combining dense and sparse retrieval, ensemble methods, fusion strategies"},
    {id:"CK",name:"Chunking & Document Segmentation",color:"#DC2626",desc:"Semantic chunking, adaptive chunking, proposition chunking strategies"},
    {id:"HI",name:"Hierarchical & Tree-Based Indexing",color:"#EA580C",desc:"Tree structures, RAPTOR, hierarchical indices, multi-level navigation"},
    {id:"MV",name:"Multi-Vector & Advanced Embeddings",color:"#BE185D",desc:"Multi-vector representations, late interaction models, attention mechanisms"},
    {id:"MM",name:"Multimodal & Visual Retrieval",color:"#F59E0B",desc:"Visual document retrieval, image-based search, multimodal RAG"},
    {id:"RR",name:"Reranking & Post-Retrieval Filtering",color:"#0369A1",desc:"Cross-encoder reranking, LLM-based scoring, adaptive K selection"},
    {id:"CC",name:"Context Compression & Optimization",color:"#4338CA",desc:"Prompt compression, context window optimization, information density"},
    {id:"VC",name:"Verification & Self-Correction",color:"#0F766E",desc:"Self-RAG, CRAG, verification loops, reflection-based quality control"},
    {id:"KG",name:"Knowledge Graph & Structured Grounding",color:"#A16207",desc:"GraphRAG, knowledge graph integration, neurosymbolic retrieval"},
    {id:"TR",name:"Training & Alignment Methods",color:"#BE123C",desc:"Fine-tuning embeddings, retriever-generator alignment, contrastive learning"},
    {id:"MS",name:"Memory & Cross-Session State",color:"#52525B",desc:"Persistent memory, caching, conversational continuity, state management"}
];
