import React, { useState, useEffect } from 'react';
import {
  Database,
  Plus,
  Trash2,
  Upload,
  Search,
  FileText,
  RefreshCw,
  Sliders,
  CheckCircle,
  AlertCircle,
  FolderOpen,
  Sparkles,
  ChevronRight,
  Zap,
  Layers,
  ArrowRight,
  X,
  FileCode,
  Check
} from 'lucide-react';
import {
  listKnowledgeBases,
  createKnowledgeBase,
  deleteKnowledgeBase,
  uploadDocumentToKB,
  listDocumentsInKB,
  deleteDocumentFromKB,
  queryKnowledgeBase
} from '../services/api';

const CHUNKING_PRESETS = [
  {
    name: 'Balanced CX (Recommended)',
    type: 'sentence',
    size: 600,
    overlap: 100,
    description: 'Optimal for customer service FAQs, return policies, and manuals.'
  },
  {
    name: 'Compact & Fast',
    type: 'sentence',
    size: 300,
    overlap: 50,
    description: 'High-precision retrieval for concise factual queries and lookup tables.'
  },
  {
    name: 'Deep Context RAG',
    type: 'token',
    size: 1000,
    overlap: 200,
    description: 'Long-form context preservation for complex technical documentation.'
  }
];

export default function KnowledgeBaseManager({ onKBsUpdated }) {
  const [kbs, setKbs] = useState([]);
  const [selectedKb, setSelectedKb] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Documents in selected KB
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // New KB form state
  const [newKbName, setNewKbName] = useState('');
  const [newKbDesc, setNewKbDesc] = useState('');
  const [chunkType, setChunkType] = useState('sentence');
  const [chunkSize, setChunkSize] = useState(600);
  const [chunkOverlap, setChunkOverlap] = useState(100);

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploadError, setUploadError] = useState('');

  // Semantic query state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadKBs();
  }, []);

  useEffect(() => {
    if (selectedKb?.id) {
      loadDocuments(selectedKb.id);
    } else {
      setDocuments([]);
    }
  }, [selectedKb?.id]);

  const loadDocuments = async (kbId) => {
    if (!kbId) return;
    setLoadingDocs(true);
    try {
      const docs = await listDocumentsInKB(kbId);
      setDocuments(docs || []);
    } catch (err) {
      console.error(`Failed to load documents for KB ${kbId}:`, err);
      setDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  const loadKBs = async (keepSelectedId = null) => {
    setLoading(true);
    try {
      const data = await listKnowledgeBases();
      setKbs(data);
      const targetId = keepSelectedId || selectedKb?.id;
      const current = (data && data.find(k => k.id === targetId)) || (data && data[0]) || null;
      setSelectedKb(current);
      if (onKBsUpdated) onKBsUpdated(data);
    } catch (err) {
      console.error('Failed to load KBs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKB = async (e) => {
    e.preventDefault();
    if (!newKbName.trim()) return;

    try {
      const res = await createKnowledgeBase({
        name: newKbName,
        description: newKbDesc,
        chunking_config: {
          chunking_type: chunkType,
          chunk_size: Number(chunkSize),
          chunk_overlap: Number(chunkOverlap)
        }
      });
      setNewKbName('');
      setNewKbDesc('');
      setShowCreateModal(false);
      await loadKBs(res?.id);
    } catch (err) {
      alert(`Failed to create KB: ${err.message}`);
    }
  };

  const handleDeleteKB = async (kbId) => {
    if (!window.confirm(`Are you sure you want to delete Knowledge Base '${kbId}'?`)) return;
    try {
      await deleteKnowledgeBase(kbId);
      if (selectedKb?.id === kbId) setSelectedKb(null);
      await loadKBs();
    } catch (err) {
      alert(`Failed to delete KB: ${err.message}`);
    }
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!uploadFile || !selectedKb) return;

    setUploading(true);
    setUploadSuccess('');
    setUploadError('');

    try {
      const res = await uploadDocumentToKB(selectedKb.id, uploadFile);
      const chunksCount = res.chunk_count ?? res.chunks_count ?? 0;
      setUploadSuccess(`Ingested "${uploadFile.name}" successfully! ${chunksCount} vector chunks generated.`);
      setUploadFile(null);
      await loadKBs(selectedKb.id);
      await loadDocuments(selectedKb.id);
    } catch (err) {
      setUploadError(`Ingestion failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId, filename) => {
    if (!window.confirm(`Are you sure you want to remove "${filename}" and its vector embeddings from this Knowledge Base?`)) return;
    try {
      await deleteDocumentFromKB(selectedKb.id, documentId);
      await loadDocuments(selectedKb.id);
      await loadKBs(selectedKb.id);
    } catch (err) {
      alert(`Failed to delete document: ${err.message}`);
    }
  };

  const handleSemanticSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim() || !selectedKb) return;

    setSearching(true);
    try {
      const results = await queryKnowledgeBase(selectedKb.id, searchQuery, 4);
      setSearchResults(results);
    } catch (err) {
      alert(`Search failed: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  const applyPreset = (preset) => {
    setChunkType(preset.type);
    setChunkSize(preset.size);
    setChunkOverlap(preset.overlap);
  };

  return (
    <div className="page-container" style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
      {/* ── Top Header Bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#09090b', letterSpacing: '-0.02em', margin: 0 }}>
              Knowledge Studio
            </h1>
            <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
              {kbs.length} Stores
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
            Manage vector stores with ChromaDB embeddings, document ingestion, and semantic retrieval tools.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.8125rem', gap: '6px' }}
          >
            <Plus size={16} />
            <span>New Knowledge Base</span>
          </button>
        </div>
      </div>

      {/* ── Empty State when no KBs exist ── */}
      {kbs.length === 0 && (
        <div style={{
          padding: '48px 24px',
          textAlign: 'center',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px dashed #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: '#000000',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Database size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              No Knowledge Bases Found
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0', maxWidth: '420px' }}>
              Create a Knowledge Base to upload enterprise documents (PDF, TXT, DOCX), generate vector embeddings, and empower agents with RAG factual retrieval.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{ padding: '8px 18px', fontSize: '0.8125rem', gap: '6px', marginTop: '6px' }}
          >
            <Plus size={16} />
            <span>Create Knowledge Base</span>
          </button>
        </div>
      )}

      {/* ── Active Knowledge Bases Cards Grid ── */}
      {kbs.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Knowledge Stores ({kbs.length})
            </span>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Click any store to inspect, upload, and test semantic search
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '10px'
          }}>
            {kbs.map((kb) => {
              const isSelected = selectedKb?.id === kb.id;
              const docCount = (kb.document_count !== undefined ? kb.document_count : kb.documents_count) || 0;
              return (
                <div
                  key={kb.id}
                  onClick={() => {
                    setSelectedKb(kb);
                    setSearchResults([]);
                    setUploadSuccess('');
                    setUploadError('');
                  }}
                  className={`kenzai-card ${isSelected ? 'active-card' : ''}`}
                  style={{
                    cursor: 'pointer',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    background: isSelected ? '#ffffff' : '#f8fafc'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: isSelected ? '#000000' : '#e2e8f0',
                        color: isSelected ? '#ffffff' : '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Database size={15} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#09090b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {kb.name}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          {docCount} Document{docCount === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isSelected ? '#000000' : '#e2e8f0',
                      color: isSelected ? '#ffffff' : '#94a3b8',
                      flexShrink: 0
                    }}>
                      <ChevronRight size={12} />
                    </div>
                  </div>

                  <p style={{
                    fontSize: '0.72rem',
                    color: '#475569',
                    margin: 0,
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {kb.description || 'No description provided'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Selected Knowledge Base Inspector & Ingestion Studio ── */}
      {selectedKb && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          alignItems: 'start'
        }}>
          {/* LEFT: Documents & Ingestion Zone */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#000000',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FolderOpen size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#09090b', margin: 0 }}>
                    {selectedKb.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: '#64748b' }}>
                    <span>Chunk Size: <strong>{selectedKb.chunking_config?.chunk_size || 600}</strong></span>
                    <span>•</span>
                    <span>Overlap: <strong>{selectedKb.chunking_config?.chunk_overlap || 100}</strong></span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDeleteKB(selectedKb.id)}
                className="btn btn-ghost"
                style={{ padding: '5px', color: '#94a3b8' }}
                title="Delete this Knowledge Base"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Ingestion Upload Box */}
            <form onSubmit={handleUploadDocument} style={{
              border: '2px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '16px',
              background: '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              textAlign: 'center'
            }}>
              <Upload size={24} color="#64748b" />
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                  Upload Enterprise Document
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Supports PDF, TXT, DOCX, MD, and JSON files
                </div>
              </div>

              <input
                type="file"
                accept=".pdf,.txt,.docx,.md,.json"
                onChange={(e) => {
                  setUploadFile(e.target.files[0]);
                  setUploadSuccess('');
                  setUploadError('');
                }}
                style={{ fontSize: '0.78rem', color: '#475569' }}
              />

              <button
                type="submit"
                disabled={!uploadFile || uploading}
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.78rem', gap: '5px' }}
              >
                {uploading ? <RefreshCw size={13} className="animate-spin-slow" /> : <Upload size={13} />}
                <span>{uploading ? 'Embedding & Indexing...' : 'Ingest Document'}</span>
              </button>

              {uploadSuccess && (
                <div style={{ fontSize: '0.75rem', color: '#047857', background: '#ecfdf5', padding: '6px 10px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                  {uploadSuccess}
                </div>
              )}

              {uploadError && (
                <div style={{ fontSize: '0.75rem', color: '#b91c1c', background: '#fef2f2', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                  {uploadError}
                </div>
              )}
            </form>

            {/* Ingested Documents List */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Indexed Documents ({documents.length})
                </span>
                {loadingDocs && <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Loading docs...</span>}
              </div>

              {documents.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  No documents ingested yet. Upload a document above to create vector embeddings.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <FileText size={15} color="#475569" />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.filename || doc.name}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                            {doc.chunk_count ?? doc.chunks_count ?? 0} Chunks • {doc.file_size ? `${Math.round(doc.file_size / 1024)} KB` : 'Vector Indexed'}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteDocument(doc.id, doc.filename || doc.name)}
                        className="btn btn-ghost"
                        style={{ padding: '4px', color: '#94a3b8' }}
                        title="Delete document"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Semantic Search Sandbox */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#000000',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Search size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#09090b', margin: 0 }}>
                  Semantic Search Sandbox
                </h3>
                <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0 }}>
                  Test vector similarity lookup and chunk relevance directly against this store.
                </p>
              </div>
            </div>

            <form onSubmit={handleSemanticSearch} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask a question or enter keywords to retrieve relevant chunks..."
                className="form-input"
                style={{ fontSize: '0.82rem' }}
              />
              <button
                type="submit"
                disabled={!searchQuery.trim() || searching}
                className="btn btn-primary"
                style={{ padding: '8px 14px', fontSize: '0.8rem', gap: '5px' }}
              >
                {searching ? <RefreshCw size={14} className="animate-spin-slow" /> : <Search size={14} />}
                <span>Query</span>
              </button>
            </form>

            {/* Results Display */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Retrieved Chunks ({searchResults.length})
                </span>
                {searching && <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Vector lookup in progress...</span>}
              </div>

              {searchResults.length === 0 ? (
                <div style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  color: '#94a3b8',
                  fontSize: '0.8rem'
                }}>
                  Enter a test query above to inspect similarity matching and vector chunk content.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto' }}>
                  {searchResults.map((res, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 12px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="badge badge-monochrome" style={{ fontSize: '0.62rem' }}>
                            Rank #{i + 1}
                          </span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#334155' }}>
                            {res.filename || 'Document'}
                          </span>
                        </div>
                        {res.score !== undefined && (
                          <span className="badge badge-safe" style={{ fontSize: '0.62rem' }}>
                            Score: {(res.score * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>

                      <div style={{
                        color: '#1e293b',
                        lineHeight: 1.45,
                        background: '#ffffff',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontFamily: 'var(--font-sans)',
                        maxHeight: '120px',
                        overflowY: 'auto'
                      }}>
                        {res.content || res.text || JSON.stringify(res)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create Knowledge Base Modal ── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '580px', maxWidth: '94vw', padding: '24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#000000',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Database size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#09090b', margin: 0 }}>
                    Create Knowledge Base
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                    Setup a vector store with custom chunking parameters.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-ghost"
                style={{ padding: '4px', borderRadius: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Presets */}
            <div style={{ marginBottom: '14px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ⚙️ Recommended Chunking Presets:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '6px' }}>
                {CHUNKING_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyPreset(p)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${chunkSize === p.size ? '#000000' : '#e2e8f0'}`,
                      background: chunkSize === p.size ? '#ffffff' : '#f8fafc',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{p.size} chars / {p.overlap} overlap</div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateKB} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '5px' }}>
                  Knowledge Base Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Return & Shipping Policies"
                  value={newKbName}
                  onChange={(e) => setNewKbName(e.target.value)}
                  className="form-input"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '5px' }}>
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Official company return policy and international shipping FAQs"
                  value={newKbDesc}
                  onChange={(e) => setNewKbDesc(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '5px' }}>
                    Chunk Size ({chunkSize} characters)
                  </label>
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="50"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '5px' }}>
                    Chunk Overlap ({chunkOverlap} characters)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="25"
                    value={chunkOverlap}
                    onChange={(e) => setChunkOverlap(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newKbName.trim()}
                  className="btn btn-primary"
                  style={{ padding: '8px 18px' }}
                >
                  Create Knowledge Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
