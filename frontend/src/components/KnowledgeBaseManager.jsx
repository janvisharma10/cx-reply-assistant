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
  FolderOpen
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
    e.preventDefault();
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
    <div style={{
      maxWidth: '1440px',
      margin: '0 auto',
      padding: '24px',
      display: 'grid',
      gridTemplateColumns: '360px 1fr',
      gap: '20px',
      height: 'calc(100vh - 66px)'
    }}>
      {/* ── Left Column: Knowledge Base List ── */}
      <div className="glass-card" style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '18px',
        gap: '14px',
        height: '100%',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={16} color="#000000" />
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#09090b' }}>Knowledge Bases ({kbs.length})</h2>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
          >
            <Plus size={13} />
            <span>New KB</span>
          </button>
        </div>

        {/* List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingRight: '4px'
        }}>
          {kbs.map((kb) => {
            const isSelected = selectedKb?.id === kb.id;
            return (
              <div
                key={kb.id}
                onClick={() => {
                  setSelectedKb(kb);
                  setSearchResults([]);
                  setUploadSuccess('');
                  setUploadError('');
                }}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? '#f8fafc' : '#ffffff',
                  border: isSelected ? '2px solid #000000' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 2px 8px rgba(0, 0, 0, 0.06)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#09090b' }}>
                    {kb.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteKB(kb.id);
                    }}
                    className="btn btn-ghost"
                    style={{ padding: '3px', color: 'var(--text-muted)' }}
                    title="Delete KB"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                  lineHeight: '1.4'
                }}>
                  {kb.description || 'No description'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem' }}>
                  <span className="badge badge-neutral" style={{ padding: '2px 6px' }}>
                    <FileText size={10} />
                    {(kb.document_count !== undefined ? kb.document_count : kb.documents_count) || 0} Docs
                  </span>
                  <span className="badge badge-monochrome" style={{ padding: '2px 6px' }}>
                    {kb.chunk_count !== undefined ? `${kb.chunk_count} Chunks` : `${kb.chunking_config?.chunk_size || 600} tokens`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right Column: Selected KB Workspace (Upload & Direct Semantic Query) ── */}
      <div className="glass-card" style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        gap: '20px',
        height: '100%',
        overflowY: 'auto'
      }}>
        {selectedKb ? (
          <>
            {/* Header Details */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border-subtle)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#09090b' }}>{selectedKb.name}</h2>
                  <span className="code-block" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>
                    {selectedKb.id}
                  </span>
                </div>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  {selectedKb.description || 'No description provided.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                  <FileText size={11} />
                  {(selectedKb.document_count !== undefined ? selectedKb.document_count : selectedKb.documents_count) || documents.length || 0} Docs
                </span>
                <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                  <Sliders size={11} />
                  Type: {selectedKb.chunking_config?.chunking_type || 'sentence'}
                </span>
                <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                  Overlap: {selectedKb.chunking_config?.chunk_overlap || 100}
                </span>
              </div>
            </div>

            {/* Document Ingestion Section */}
            <div style={{
              padding: '18px',
              borderRadius: 'var(--radius-lg)',
              background: '#ffffff',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Upload size={16} color="#000000" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#09090b' }}>Ingest Document (PDF or TXT)</h3>
              </div>

              <form onSubmit={handleUploadDocument} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  border: '1px dashed var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  padding: '20px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  cursor: 'pointer'
                }}>
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    id="kb-file-input"
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="kb-file-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <FolderOpen size={28} color="#09090b" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#09090b' }}>
                      {uploadFile ? uploadFile.name : 'Click to select PDF or text file for embedding'}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Supports PDF, TXT, and Markdown files
                    </span>
                  </label>
                </div>

                {uploadSuccess && (
                  <div className="badge badge-safe" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                    <CheckCircle size={13} />
                    <span>{uploadSuccess}</span>
                  </div>
                )}

                {uploadError && (
                  <div className="badge badge-danger" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                    <AlertCircle size={13} />
                    <span>{uploadError}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={!uploadFile || uploading}
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                  >
                    {uploading ? <RefreshCw size={13} className="animate-spin-slow" /> : <Upload size={13} />}
                    <span>{uploading ? 'Chunking & Embedding...' : 'Ingest Document'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Indexed Documents Section */}
            <div style={{
              padding: '18px',
              borderRadius: 'var(--radius-lg)',
              background: '#ffffff',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} color="#000000" />
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#09090b' }}>
                    Indexed Documents ({documents.length})
                  </h3>
                </div>
                {loadingDocs && <RefreshCw size={14} className="animate-spin-slow" color="var(--text-muted)" />}
              </div>

              {documents.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '24px',
                  color: 'var(--text-muted)',
                  fontSize: '0.78rem',
                  background: '#f8fafc',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-subtle)'
                }}>
                  No documents indexed yet. Upload a PDF above to extract, chunk, and embed documents into this Knowledge Base.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {documents.map((doc) => (
                    <div
                      key={doc.document_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: '#f8fafc',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: 'var(--radius-sm)',
                          background: '#09090b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <FileText size={16} color="#ffffff" />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#09090b' }}>
                            {doc.filename}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            Ingested {doc.created_at ? new Date(doc.created_at).toLocaleString() : 'Recently'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                          {doc.chunk_count} {doc.chunk_count === 1 ? 'chunk' : 'chunks'}
                        </span>
                        <button
                          onClick={() => handleDeleteDocument(doc.document_id, doc.filename)}
                          className="btn btn-ghost"
                          style={{ padding: '6px', color: 'var(--text-muted)' }}
                          title="Remove document from KB"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Direct Semantic Search Tester */}
            <div style={{
              padding: '18px',
              borderRadius: 'var(--radius-lg)',
              background: '#ffffff',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={16} color="#000000" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#09090b' }}>Vector Retrieval Inspector</h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Test ChromaDB vector similarity search directly to view chunks and similarity scores retrieved for this KB.
              </p>

              <form onSubmit={handleSemanticSearch} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter a test search query (e.g., return window or standard delivery)..."
                  className="form-input"
                  style={{ flex: 1, background: '#ffffff', color: '#09090b', border: '1px solid var(--border-strong)' }}
                />
                <button
                  type="submit"
                  disabled={!searchQuery.trim() || searching}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                >
                  {searching ? <RefreshCw size={13} className="animate-spin-slow" /> : <Search size={13} />}
                  <span>Search</span>
                </button>
              </form>

              {/* Search Results Display */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {searchResults.map((r, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 14px',
                      background: '#f8fafc',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span className="badge badge-monochrome" style={{ fontSize: '0.68rem' }}>
                        Chunk {idx + 1} • Similarity: {r.score}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Source: {r.filename}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.8rem',
                      color: '#09090b',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.5'
                    }}>
                      {r.text}
                    </p>
                  </div>
                ))}

                {searchResults.length === 0 && !searching && searchQuery && (
                  <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    No matching chunks returned for query.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            gap: '12px'
          }}>
            <Database size={40} color="#cbd5e1" />
            <p style={{ fontSize: '0.85rem' }}>Select a Knowledge Base from the left or create a new one.</p>
          </div>
        )}
      </div>

      {/* ── Create Knowledge Base Modal ── */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div className="glass-card" style={{
            width: '540px',
            maxWidth: '90vw',
            padding: '28px',
            background: '#ffffff',
            border: '1px solid var(--border-strong)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#09090b' }}>Create New Knowledge Base</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-ghost"
                style={{ padding: '4px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateKB} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#09090b', marginBottom: '5px' }}>
                  KB Name *
                </label>
                <input
                  type="text"
                  required
                  value={newKbName}
                  onChange={(e) => setNewKbName(e.target.value)}
                  placeholder="e.g. Return & Warranty Policy"
                  className="form-input"
                  style={{ background: '#ffffff', color: '#09090b', border: '1px solid var(--border-strong)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#09090b', marginBottom: '5px' }}>
                  Description (Used by Agent Reasoning to decide routing) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={newKbDesc}
                  onChange={(e) => setNewKbDesc(e.target.value)}
                  placeholder="Rules, returns, warranty windows, and customer refund guidelines"
                  className="form-textarea"
                  style={{ background: '#ffffff', color: '#09090b', border: '1px solid var(--border-strong)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#09090b', marginBottom: '5px' }}>
                    Chunk Size (Tokens)
                  </label>
                  <input
                    type="number"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(e.target.value)}
                    className="form-input"
                    style={{ background: '#ffffff', color: '#09090b', border: '1px solid var(--border-strong)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#09090b', marginBottom: '5px' }}>
                    Chunk Overlap
                  </label>
                  <input
                    type="number"
                    value={chunkOverlap}
                    onChange={(e) => setChunkOverlap(e.target.value)}
                    className="form-input"
                    style={{ background: '#ffffff', color: '#09090b', border: '1px solid var(--border-strong)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
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
