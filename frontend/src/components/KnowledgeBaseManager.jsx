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
  ArrowRight
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
      setUploadSuccess(`Ingested "${uploadFile.name}" successfully! ${chunksCount} chunks created and embedded.`);
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
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
            Knowledge Studio
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '3px 0 0' }}>
            Vector-indexed enterprise knowledge bases with ChromaDB embeddings and Agno semantic retrieval tools.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => loadKBs()}
            className="btn btn-ghost"
            style={{ padding: '7px 12px', fontSize: '0.8rem', gap: '6px', border: '1px solid #e5e7eb' }}
            title="Refresh Knowledge Bases"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin-slow' : ''} />
            <span>Sync</span>
          </button>

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
          borderRadius: '14px',
          border: '1px dashed #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: '#000000',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Database size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#111827', margin: 0 }}>
              No Knowledge Bases Found
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '4px 0 0', maxWidth: '420px' }}>
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
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Knowledge Bases ({kbs.length})
            </span>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              Click any card to inspect and upload documents
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px'
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
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: '#000000',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Database size={16} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          color: '#111827',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {kb.name}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>
                          {kb.id}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteKB(kb.id);
                      }}
                      className="btn btn-ghost"
                      style={{ padding: '4px', color: '#9ca3af' }}
                      title="Delete Knowledge Base"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <p style={{
                    fontSize: '0.75rem',
                    color: '#4b5563',
                    margin: 0,
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {kb.description || 'No description provided.'}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid #f3f4f6' }}>
                    <span className="kenzai-tag">
                      [ DOCS: {docCount} ]
                    </span>
                    <span className="kenzai-tag">
                      [ {kb.chunking_config?.chunking_type || 'sentence'}: {kb.chunking_config?.chunk_size || 600} ]
                    </span>
                    <span className="kenzai-tag" style={{ color: '#047857', background: '#ecfdf5' }}>
                      [ VECTOR READY ]
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Selected Knowledge Base Management Workspace ── */}
      {selectedKb && (
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          {/* Header of Active KB */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            background: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
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
                <Layers size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#111827' }}>
                  {selectedKb.name} Workspace
                </div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                  Chunk strategy: <strong>{selectedKb.chunking_config?.chunking_type || 'sentence'}</strong> ({selectedKb.chunking_config?.chunk_size || 600} tokens, {selectedKb.chunking_config?.chunk_overlap || 100} overlap)
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                <FileText size={11} />
                {documents.length} Ingested Document{documents.length === 1 ? '' : 's'}
              </span>
              <span className="badge badge-safe" style={{ fontSize: '0.72rem' }}>
                ChromaDB Vector Store
              </span>
            </div>
          </div>

          {/* Master Detail 2-Column Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
            gap: '20px',
            padding: '20px'
          }}>
            {/* ── Left Column: Documents & Ingestion ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* File Upload Card */}
              <div style={{
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
                background: '#ffffff'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Upload size={16} color="#000000" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>
                    Upload & Ingest Documents
                  </span>
                </div>

                <form onSubmit={handleUploadDocument} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{
                    border: '1px dashed #cbd5e1',
                    borderRadius: '8px',
                    padding: '18px 14px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}>
                    <input
                      type="file"
                      accept=".pdf,.txt,.md,.docx"
                      onChange={(e) => setUploadFile(e.target.files[0])}
                      id="kb-file-upload-input"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="kb-file-upload-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <FolderOpen size={24} color="#374151" />
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827' }}>
                        {uploadFile ? uploadFile.name : 'Select or drop enterprise PDF / TXT / MD'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        Automatic sentence chunking, vector embedding, and ChromaDB storage
                      </span>
                    </label>
                  </div>

                  {uploadSuccess && (
                    <div className="badge badge-safe" style={{ padding: '6px 10px', fontSize: '0.72rem' }}>
                      <CheckCircle size={12} />
                      <span>{uploadSuccess}</span>
                    </div>
                  )}

                  {uploadError && (
                    <div className="badge badge-danger" style={{ padding: '6px 10px', fontSize: '0.72rem' }}>
                      <AlertCircle size={12} />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      disabled={!uploadFile || uploading}
                      className="btn btn-primary"
                      style={{ padding: '7px 16px', fontSize: '0.78rem', gap: '6px' }}
                    >
                      {uploading ? <RefreshCw size={13} className="animate-spin-slow" /> : <Upload size={13} />}
                      <span>{uploading ? 'Chunking & Embedding...' : 'Ingest Document'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Indexed Documents Table */}
              <div style={{
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
                background: '#ffffff',
                flex: 1
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={16} color="#000000" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>
                      Indexed Documents ({documents.length})
                    </span>
                  </div>
                  {loadingDocs && <RefreshCw size={13} className="animate-spin-slow" color="#9ca3af" />}
                </div>

                {documents.length === 0 ? (
                  <div style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    color: '#9ca3af',
                    fontSize: '0.78rem',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px dashed #e2e8f0'
                  }}>
                    No documents indexed yet. Upload a policy PDF above to extract chunks.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                    {documents.map((doc) => (
                      <div
                        key={doc.document_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <div style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '5px',
                            background: '#000000',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <FileText size={13} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.filename}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
                              {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Ingested'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>
                            {doc.chunk_count || 1} chunks
                          </span>
                          <button
                            onClick={() => handleDeleteDocument(doc.document_id, doc.filename)}
                            className="btn btn-ghost"
                            style={{ padding: '4px', color: '#9ca3af' }}
                            title="Delete document"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right Column: Semantic Vector Query Inspector ── */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid #e5e7eb',
              background: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={16} color="#000000" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>
                  Semantic Retrieval Inspector
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0, lineHeight: 1.4 }}>
                Directly query this vector database to verify chunk relevance and similarity score embeddings before connecting to agents.
              </p>

              {/* Search Form */}
              <form onSubmit={handleSemanticSearch} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter a test question or keyword..."
                  className="form-input"
                  style={{ flex: 1, fontSize: '0.82rem', padding: '8px 12px', border: '1px solid #cbd5e1' }}
                />
                <button
                  type="submit"
                  disabled={!searchQuery.trim() || searching}
                  className="btn btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '0.78rem', gap: '5px' }}
                >
                  {searching ? <RefreshCw size={13} className="animate-spin-slow" /> : <Search size={13} />}
                  <span>Search</span>
                </button>
              </form>

              {/* Results List */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                flex: 1,
                maxHeight: '340px',
                overflowY: 'auto'
              }}>
                {searchResults.map((r, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      background: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span className="badge badge-monochrome" style={{ fontSize: '0.65rem' }}>
                        Chunk {idx + 1} • Score: {typeof r.score === 'number' ? r.score.toFixed(3) : r.score || 'Match'}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>
                        Source: {r.filename}
                      </span>
                    </div>
                    <p style={{
                      margin: 0,
                      color: '#334155',
                      lineHeight: '1.45',
                      fontFamily: 'var(--font-sans)',
                      background: '#ffffff',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #f1f5f9',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {r.text}
                    </p>
                  </div>
                ))}

                {searchResults.length === 0 && !searching && searchQuery && (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '0.75rem' }}>
                    No matching chunks returned for query.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Knowledge Base Modal ── */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div className="glass-card modal-dialog" style={{
            width: '520px',
            maxWidth: '92vw',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '22px',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={18} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                  Create New Knowledge Base
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-ghost"
                style={{ padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateKB} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#111827', marginBottom: '5px' }}>
                  Knowledge Base Name *
                </label>
                <input
                  type="text"
                  required
                  value={newKbName}
                  onChange={(e) => setNewKbName(e.target.value)}
                  placeholder="e.g. Return & Warranty Policy"
                  className="form-input"
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#111827', marginBottom: '5px' }}>
                  Description (Used by Agent Reasoning Engine to decide routing) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={newKbDesc}
                  onChange={(e) => setNewKbDesc(e.target.value)}
                  placeholder="30-day return policy, warranty terms, condition rules, and refund processing."
                  className="form-textarea"
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#111827', marginBottom: '5px' }}>
                    Chunk Size (Tokens)
                  </label>
                  <input
                    type="number"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(e.target.value)}
                    className="form-input"
                    style={{ background: '#ffffff', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#111827', marginBottom: '5px' }}>
                    Chunk Overlap (Tokens)
                  </label>
                  <input
                    type="number"
                    value={chunkOverlap}
                    onChange={(e) => setChunkOverlap(e.target.value)}
                    className="form-input"
                    style={{ background: '#ffffff', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
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
                  className="btn btn-primary"
                  style={{ padding: '8px 18px' }}
                >
                  Create Knowledge Base
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
