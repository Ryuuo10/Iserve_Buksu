import React, { useEffect, useRef, useState } from 'react';
import authService from '../../../services/authService';
import cloudinaryService from '../../../services/cloudinaryService';
import supportService from '../../../services/supportService';
import {
  MAX_FILE_COUNT,
  MAX_FILE_SIZE,
  categoryOptions,
  contactInfo,
  faqByCategory,
  guideCards,
} from './helpSupportData';

const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'video/mp4',
  'video/avi',
  'video/x-msvideo',
  'video/mov',
  'video/quicktime',
]);

const emptyForm = { subject: '', category: 'general', priority: 'medium', description: '', files: [] };
const emptyUpdateForm = { message: '', files: [] };
const dateFormatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

const matchesSearch = (searchValue, text) => text.toLowerCase().includes(searchValue);
const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : 'Not available');
const formatDateTime = (value) => (value ? dateTimeFormatter.format(new Date(value)) : 'Not available');
const sortTicketsByActivity = (tickets) =>
  [...tickets].sort((a, b) => new Date(b.lastActivityAt || b.updatedAt || b.createdAt) - new Date(a.lastActivityAt || a.updatedAt || a.createdAt));

const getStatusClasses = (status) =>
  ({
    resolved: 'bg-green-50 text-green-700 border-green-200',
    closed: 'bg-gray-100 text-gray-700 border-gray-200',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  }[status] || 'bg-amber-50 text-amber-700 border-amber-200');

const getPriorityClasses = (priority) =>
  ({
    high: 'bg-red-50 text-red-700 border-red-200',
    low: 'bg-gray-100 text-gray-700 border-gray-200',
  }[priority] || 'bg-purple-50 text-purple-700 border-purple-200');

const HelpSupportModule = () => {
  const guidesRef = useRef(null);
  const faqRef = useRef(null);
  const ticketFormRef = useRef(null);
  const ticketsRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeGuideId, setActiveGuideId] = useState('file-grievance');
  const [activeCategory, setActiveCategory] = useState('filing');
  const [expandedFaqKey, setExpandedFaqKey] = useState(null);
  const [ticketForm, setTicketForm] = useState(emptyForm);
  const [ticketUpdateForm, setTicketUpdateForm] = useState(emptyUpdateForm);
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetailLoading, setTicketDetailLoading] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [sendingUpdate, setSendingUpdate] = useState(false);

  const activeGuide = guideCards.find((guide) => guide.id === activeGuideId) || guideCards[0];
  const activeFaqs = faqByCategory[activeCategory] || [];
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchingGuides = normalizedSearch
    ? guideCards.filter(
        (guide) =>
          matchesSearch(normalizedSearch, guide.title) ||
          matchesSearch(normalizedSearch, guide.description) ||
          guide.steps.some((step) => matchesSearch(normalizedSearch, step))
      )
    : [];
  const matchingFaqs = normalizedSearch
    ? Object.entries(faqByCategory)
        .flatMap(([category, items]) => items.map((item, index) => ({ ...item, category, key: `${category}-${index}` })))
        .filter((item) => matchesSearch(normalizedSearch, item.question) || matchesSearch(normalizedSearch, item.answer))
    : [];

  const scrollToSection = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    window.clearTimeout(HelpSupportModule.messageTimeout);
    HelpSupportModule.messageTimeout = window.setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const syncTicketList = (ticket) => {
    setTickets((previous) => sortTicketsByActivity([ticket, ...previous.filter((item) => item.ticketId !== ticket.ticketId)]));
  };

  const loadTicketDetail = async (ticketId, fallbackTicket = null) => {
    if (!ticketId) {
      setSelectedTicketId('');
      setSelectedTicket(null);
      return;
    }

    setSelectedTicketId(ticketId);
    setTicketDetailLoading(true);
    const response = await supportService.getTicketById(ticketId);

    if (response.success && response.ticket) {
      setSelectedTicket(response.ticket);
      syncTicketList(response.ticket);
    } else {
      setSelectedTicket(fallbackTicket);
      showMessage('error', response.message || 'Failed to load support ticket details');
    }

    setTicketDetailLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [profileResponse, ticketsResponse] = await Promise.all([authService.getProfile(), supportService.getTickets()]);
        if (!mounted) return;

        if (profileResponse.success && profileResponse.user) {
          setProfile(profileResponse.user);
        }

        if (ticketsResponse.success && Array.isArray(ticketsResponse.tickets)) {
          const orderedTickets = sortTicketsByActivity(ticketsResponse.tickets);
          setTickets(orderedTickets);
          if (orderedTickets[0]) {
            await loadTicketDetail(orderedTickets[0].ticketId, orderedTickets[0]);
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
      window.clearTimeout(HelpSupportModule.messageTimeout);
    };
  }, []);

  const openGuide = (guideId) => {
    const guide = guideCards.find((item) => item.id === guideId);
    if (!guide) return;
    setActiveGuideId(guide.id);
    setActiveCategory(guide.category);
    scrollToSection(guidesRef);
  };

  const openFaq = (category, faqKey) => {
    setActiveCategory(category);
    setExpandedFaqKey(faqKey);
    scrollToSection(faqRef);
  };

  const validateFiles = (fileList) => {
    const files = Array.from(fileList || []);

    if (files.length > MAX_FILE_COUNT) {
      return { files: [], error: `You can attach up to ${MAX_FILE_COUNT} files.` };
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return { files: [], error: `${file.name} is larger than 10MB.` };
      }

      if (!ALLOWED_FILE_TYPES.has(file.type)) {
        return { files: [], error: `${file.name} is not a supported file type.` };
      }
    }

    return { files, error: '' };
  };

  const uploadAttachments = async (files) => {
    if (!files.length) return [];
    const uploads = await cloudinaryService.uploadMultipleFilesToCloudinary(files);
    const successfulUploads = uploads.filter((item) => item?.success && item.url);

    if (successfulUploads.length !== files.length) {
      throw new Error('One or more attachments failed to upload');
    }

    return successfulUploads.map((item) => ({
      url: item.url,
      publicId: item.publicId || null,
      fileName: item.originalName || null,
      fileType: item.format || item.resourceType || null,
      size: item.size || null,
    }));
  };

  const handleFileSelection = (target, fileList) => {
    const { files, error } = validateFiles(fileList);
    if (error) {
      showMessage('error', error);
      return;
    }

    if (target === 'ticket') {
      setTicketForm((previous) => ({ ...previous, files }));
    } else {
      setTicketUpdateForm((previous) => ({ ...previous, files }));
    }
  };

  const handleTicketSubmit = async (event) => {
    event.preventDefault();

    if (!ticketForm.subject.trim() || !ticketForm.description.trim()) {
      showMessage('error', 'Subject and description are required');
      return;
    }

    setSubmittingTicket(true);

    try {
      const attachments = await uploadAttachments(ticketForm.files);
      const response = await supportService.createTicket({
        subject: ticketForm.subject.trim(),
        category: ticketForm.category,
        priority: ticketForm.priority,
        description: ticketForm.description.trim(),
        attachments,
      });

      if (!response.success || !response.ticket) {
        throw new Error(response.message || 'Failed to create support ticket');
      }

      syncTicketList(response.ticket);
      setSelectedTicket(response.ticket);
      setSelectedTicketId(response.ticket.ticketId);
      setTicketForm(emptyForm);
      setTicketUpdateForm(emptyUpdateForm);
      showMessage('success', `Support ticket ${response.ticket.ticketId} created successfully.`);
      scrollToSection(ticketsRef);
    } catch (error) {
      showMessage('error', error.message || 'Failed to create support ticket');
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleTicketUpdateSubmit = async (event) => {
    event.preventDefault();

    if (!selectedTicket) {
      showMessage('error', 'Select a ticket first');
      return;
    }

    if (!ticketUpdateForm.message.trim()) {
      showMessage('error', 'Add a short update before sending');
      return;
    }

    setSendingUpdate(true);

    try {
      const attachments = await uploadAttachments(ticketUpdateForm.files);
      const response = await supportService.addTicketMessage(selectedTicket.ticketId, {
        message: ticketUpdateForm.message.trim(),
        attachments,
      });

      if (!response.success || !response.ticket) {
        throw new Error(response.message || 'Failed to update support ticket');
      }

      syncTicketList(response.ticket);
      setSelectedTicket(response.ticket);
      setTicketUpdateForm(emptyUpdateForm);
      showMessage('success', `Ticket ${response.ticket.ticketId} updated successfully.`);
    } catch (error) {
      showMessage('error', error.message || 'Failed to update support ticket');
    } finally {
      setSendingUpdate(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse">
            <div className="w-16 h-16 bg-gray-200 rounded-full mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-48 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-32"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="text-left">
            <h2 className="text-white font-heading-md">Help & Support</h2>
            <p className="text-white/85 font-body-sm">
              Search help content, review common answers, and create a real support ticket when needed.
            </p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white/90">
            <p className="font-semibold text-white">{profile?.name || 'Signed in user'}</p>
            <p>{profile?.email || 'Profile email unavailable'}</p>
          </div>
        </div>
      </div>
      {message.text && (
        <div
          className={`mx-6 mt-4 p-4 rounded-xl border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <p className="font-medium text-sm">{message.text}</p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => openGuide('file-grievance')}
              className="text-left bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-5 text-white"
            >
              <p className="text-sm uppercase tracking-wide text-white/75">Quick Guide</p>
              <h3 className="font-semibold text-lg mt-2">How to file a grievance</h3>
              <p className="text-sm text-white/85 mt-2">
                Open the filing guide and review the required details before you submit.
              </p>
            </button>
            <button
              type="button"
              onClick={() => openFaq('technical', 'technical-0')}
              className="text-left bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-5 text-white"
            >
              <p className="text-sm uppercase tracking-wide text-white/75">Troubleshooting</p>
              <h3 className="font-semibold text-lg mt-2">Common technical fixes</h3>
              <p className="text-sm text-white/85 mt-2">Jump straight to upload, browser, and performance help.</p>
            </button>
            <button
              type="button"
              onClick={() => scrollToSection(ticketFormRef)}
              className="text-left bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl p-5 text-white"
            >
              <p className="text-sm uppercase tracking-wide text-white/75">Need More Help</p>
              <h3 className="font-semibold text-lg mt-2">Create a support ticket</h3>
              <p className="text-sm text-white/85 mt-2">
                Submit a real ticket with details and optional attachments.
              </p>
            </button>
            <button
              type="button"
              onClick={() => scrollToSection(ticketsRef)}
              className="text-left bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 text-white"
            >
              <p className="text-sm uppercase tracking-wide text-white/75">Ticket History</p>
              <h3 className="font-semibold text-lg mt-2">My support tickets</h3>
              <p className="text-sm text-white/85 mt-2">
                Review previous tickets and add more details to an existing case.
              </p>
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Search the Help Center</h3>
              <p className="text-sm text-gray-600 mt-1">Find guides and answers before creating a ticket.</p>
            </div>
            <div className="p-5">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Search for filing, tracking, upload, password, privacy..."
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {normalizedSearch ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-5">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3">Matching Guides</h4>
                    <div className="space-y-3">
                      {matchingGuides.length ? (
                        matchingGuides.slice(0, 5).map((guide) => (
                          <button
                            key={guide.id}
                            type="button"
                            onClick={() => openGuide(guide.id)}
                            className="w-full text-left rounded-lg border border-gray-200 bg-white p-3 hover:border-purple-300 hover:bg-purple-50"
                          >
                            <p className="font-medium text-gray-900">{guide.title}</p>
                            <p className="text-sm text-gray-600 mt-1">{guide.description}</p>
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-gray-600">No guides matched your search.</p>
                      )}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3">Matching Questions</h4>
                    <div className="space-y-3">
                      {matchingFaqs.length ? (
                        matchingFaqs.slice(0, 5).map((faq) => (
                          <button
                            key={faq.key}
                            type="button"
                            onClick={() => openFaq(faq.category, faq.key)}
                            className="w-full text-left rounded-lg border border-gray-200 bg-white p-3 hover:border-purple-300 hover:bg-purple-50"
                          >
                            <p className="font-medium text-gray-900">{faq.question}</p>
                            <p className="text-sm text-gray-600 mt-1">{faq.answer}</p>
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-gray-600">No FAQ entries matched your search.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-5">
                  {guideCards.map((guide) => (
                    <button
                      key={guide.id}
                      type="button"
                      onClick={() => openGuide(guide.id)}
                      className={`text-left rounded-xl border p-4 ${
                        activeGuideId === guide.id
                          ? 'border-purple-200 bg-purple-50'
                          : 'border-gray-200 bg-white hover:border-purple-200 hover:bg-purple-50'
                      }`}
                    >
                      <p className="text-xs uppercase tracking-wide text-purple-700">
                        {categoryOptions.find((option) => option.id === guide.category)?.name || 'Guide'}
                      </p>
                      <h4 className="font-semibold text-gray-900 mt-2">{guide.title}</h4>
                      <p className="text-sm text-gray-600 mt-2">{guide.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div ref={guidesRef} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Guided Help</h3>
              <p className="text-sm text-gray-600 mt-1">Step-by-step help for the most common actions.</p>
            </div>
            <div className="p-5 grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="space-y-3">
                {guideCards.map((guide) => (
                  <button
                    key={guide.id}
                    type="button"
                    onClick={() => openGuide(guide.id)}
                    className={`w-full text-left rounded-xl border p-4 ${
                      activeGuideId === guide.id
                        ? 'border-purple-200 bg-purple-50'
                        : 'border-gray-200 bg-gray-50 hover:border-purple-200 hover:bg-purple-50'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{guide.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{guide.description}</p>
                  </button>
                ))}
              </div>
              <div className="xl:col-span-2 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-5">
                <p className="text-xs uppercase tracking-wide text-purple-700">
                  {categoryOptions.find((option) => option.id === activeGuide.category)?.name || 'Guide'}
                </p>
                <h4 className="text-xl font-semibold text-gray-900 mt-2">{activeGuide.title}</h4>
                <p className="text-gray-600 mt-2">{activeGuide.description}</p>
                <div className="mt-5 space-y-3">
                  {activeGuide.steps.map((step, index) => (
                    <div key={step} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-4">
                      <div className="w-8 h-8 flex-shrink-0 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-semibold text-sm">
                        {index + 1}
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div ref={faqRef} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">FAQ Categories</h3>
                <p className="text-sm text-gray-600 mt-1">Browse answers by topic.</p>
              </div>
              <div className="p-3">
                {categoryOptions.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setActiveCategory(category.id);
                      setExpandedFaqKey(null);
                    }}
                    className={`w-full text-left rounded-xl px-4 py-3 ${
                      activeCategory === category.id
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <p className="font-medium">{category.name}</p>
                    <p className="text-xs opacity-75 mt-1">{category.description}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Frequently Asked Questions</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {categoryOptions.find((category) => category.id === activeCategory)?.description}
                </p>
              </div>
              <div className="p-5 space-y-4">
                {activeFaqs.map((faq, index) => {
                  const faqKey = `${activeCategory}-${index}`;
                  const expanded = expandedFaqKey === faqKey;

                  return (
                    <div key={faqKey} className="rounded-xl border border-gray-200 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedFaqKey(expanded ? null : faqKey)}
                        className="w-full text-left bg-gray-50 hover:bg-gray-100 px-4 py-4 flex items-center justify-between gap-4"
                      >
                        <span className="font-medium text-gray-900">{faq.question}</span>
                        <svg
                          className={`w-5 h-5 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expanded && (
                        <div className="px-4 py-4 bg-white">
                          <p className="text-sm text-gray-700 leading-relaxed">{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div ref={ticketFormRef} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Create Support Ticket</h3>
              <p className="text-sm text-gray-600 mt-1">Use this if the guides and FAQ did not solve your issue.</p>
            </div>
            <form onSubmit={handleTicketSubmit} className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                  <input
                    type="text"
                    value={ticketForm.subject}
                    onChange={(event) => setTicketForm((previous) => ({ ...previous, subject: event.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Brief summary of your issue"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={ticketForm.category}
                    onChange={(event) => setTicketForm((previous) => ({ ...previous, category: event.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <div className="flex flex-wrap gap-3">
                  {['low', 'medium', 'high'].map((priority) => (
                    <label
                      key={priority}
                      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm capitalize ${
                        ticketForm.priority === priority
                          ? 'border-purple-300 bg-purple-50 text-purple-700'
                          : 'border-gray-300 text-gray-700'
                      }`}
                    >
                      <input
                        type="radio"
                        value={priority}
                        checked={ticketForm.priority === priority}
                        onChange={(event) => setTicketForm((previous) => ({ ...previous, priority: event.target.value }))}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                      {priority}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={ticketForm.description}
                  onChange={(event) => setTicketForm((previous) => ({ ...previous, description: event.target.value }))}
                  rows="5"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Describe the issue, what you expected, and what happened instead."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Optional Attachments</label>
                <label className="flex items-center justify-center w-full rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center cursor-pointer hover:border-purple-300 hover:bg-purple-50">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.mp4,.avi,.mov"
                    onChange={(event) => handleFileSelection('ticket', event.target.files)}
                  />
                  <div>
                    <p className="font-medium text-gray-900">Choose up to 3 files</p>
                    <p className="text-sm text-gray-600 mt-1">PDF, JPG, PNG, MP4, AVI, MOV. Max 10MB each.</p>
                  </div>
                </label>
                {ticketForm.files.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ticketForm.files.map((file) => (
                      <span key={file.name} className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-xs">
                        {file.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={submittingTicket}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-6 py-3 rounded-xl font-semibold"
              >
                {submittingTicket ? 'Submitting Ticket...' : 'Submit Support Ticket'}
              </button>
            </form>
          </div>

          <div ref={ticketsRef} className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">My Support Tickets</h3>
                <p className="text-sm text-gray-600 mt-1">Open a ticket to review details or add a follow-up.</p>
              </div>
              <div className="p-4 space-y-3 max-h-[720px] overflow-y-auto">
                {tickets.length ? (
                  tickets.map((ticket) => {
                    const latestSupportReply = [...(ticket.messages || [])]
                      .reverse()
                      .find((item) => item.source === 'support_reply');

                    return (
                      <button
                        key={ticket.ticketId}
                        type="button"
                        onClick={() => loadTicketDetail(ticket.ticketId, ticket)}
                        className={`w-full text-left rounded-xl border p-4 ${
                          selectedTicketId === ticket.ticketId
                            ? 'border-purple-200 bg-purple-50'
                            : 'border-gray-200 bg-white hover:border-purple-200 hover:bg-purple-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2 justify-between">
                          <p className="font-semibold text-gray-900">{ticket.ticketId}</p>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(ticket.status)}`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="font-medium text-gray-800 mt-3">{ticket.subject}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getPriorityClasses(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                          <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
                            {ticket.category}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                          Last activity: {formatDateTime(ticket.lastActivityAt || ticket.updatedAt || ticket.createdAt)}
                        </p>
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {latestSupportReply?.message || 'No support reply yet. You can still add more details to this ticket.'}
                        </p>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                    <p className="font-medium text-gray-900">No support tickets yet</p>
                    <p className="text-sm text-gray-600 mt-2">Use the form above when you need help that is not covered by the Help Center.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="xl:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[520px]">
              <div className="p-5 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Ticket Details</h3>
                <p className="text-sm text-gray-600 mt-1">Review the history and add clarifying information when needed.</p>
              </div>
              {ticketDetailLoading ? (
                <div className="p-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-6 bg-gray-200 rounded w-40"></div>
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                  </div>
                </div>
              ) : selectedTicket ? (
                <div className="p-5 space-y-5">
                  <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-purple-700">{selectedTicket.ticketId}</p>
                        <h4 className="text-xl font-semibold text-gray-900 mt-2">{selectedTicket.subject}</h4>
                        <p className="text-sm text-gray-600 mt-2">{selectedTicket.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(selectedTicket.status)}`}>
                          {selectedTicket.status.replace('_', ' ')}
                        </span>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getPriorityClasses(selectedTicket.priority)}`}>
                          {selectedTicket.priority}
                        </span>
                        <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">
                          {selectedTicket.category}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 text-sm">
                      <div className="rounded-xl bg-white border border-gray-200 p-4">
                        <p className="text-gray-500">Created</p>
                        <p className="font-medium text-gray-900 mt-1">{formatDate(selectedTicket.createdAt)}</p>
                      </div>
                      <div className="rounded-xl bg-white border border-gray-200 p-4">
                        <p className="text-gray-500">Last Activity</p>
                        <p className="font-medium text-gray-900 mt-1">{formatDateTime(selectedTicket.lastActivityAt || selectedTicket.updatedAt)}</p>
                      </div>
                      <div className="rounded-xl bg-white border border-gray-200 p-4">
                        <p className="text-gray-500">Attachments</p>
                        <p className="font-medium text-gray-900 mt-1">{selectedTicket.attachments?.length || 0}</p>
                      </div>
                    </div>
                    {selectedTicket.attachments?.length > 0 && (
                      <div className="mt-5">
                        <p className="font-medium text-gray-900 mb-2">Initial Attachments</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedTicket.attachments.map((attachment) => (
                            <a
                              key={`${selectedTicket.ticketId}-${attachment.url}`}
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-purple-300 hover:text-purple-700"
                            >
                              {attachment.fileName || 'Attachment'}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-900 mb-3">Conversation</h5>
                    <div className="space-y-3">
                      {(selectedTicket.messages || []).map((item) => (
                        <div
                          key={item._id || `${item.authorName}-${item.createdAt}`}
                          className={`rounded-2xl border p-4 ${
                            item.source === 'support_reply' ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{item.authorName}</p>
                              <p className="text-xs uppercase tracking-wide text-gray-500">{item.source.replace('_', ' ')}</p>
                            </div>
                            <p className="text-xs text-gray-500">{formatDateTime(item.createdAt)}</p>
                          </div>
                          <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{item.message}</p>
                          {item.attachments?.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {item.attachments.map((attachment) => (
                                <a
                                  key={`${attachment.url}-${item.createdAt}`}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-purple-300 hover:text-purple-700"
                                >
                                  {attachment.fileName || 'Attachment'}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <form onSubmit={handleTicketUpdateSubmit} className="rounded-2xl border border-gray-200 bg-gray-50 p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Add More Details</label>
                      <textarea
                        value={ticketUpdateForm.message}
                        onChange={(event) => setTicketUpdateForm((previous) => ({ ...previous, message: event.target.value }))}
                        rows="4"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        placeholder="Add clarifications, new observations, or follow-up details for this ticket."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Optional Attachments</label>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.mp4,.avi,.mov"
                        onChange={(event) => handleFileSelection('update', event.target.files)}
                        className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-full file:border-0 file:bg-purple-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-purple-700 hover:file:bg-purple-100"
                      />
                      {ticketUpdateForm.files.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {ticketUpdateForm.files.map((file) => (
                            <span key={file.name} className="inline-flex items-center rounded-full bg-white text-gray-700 px-3 py-1 text-xs border border-gray-200">
                              {file.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={sendingUpdate}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-5 py-2.5 rounded-xl font-semibold"
                    >
                      {sendingUpdate ? 'Sending Update...' : 'Send Ticket Update'}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="p-6">
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                    <p className="font-medium text-gray-900">No ticket selected</p>
                    <p className="text-sm text-gray-600 mt-2">Create a ticket above or choose one from the list to view its details.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Contact Information</h3>
              <p className="text-sm text-gray-600 mt-1">Use these channels for office hours and direct contact details.</p>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              {contactInfo.map((contact) => (
                <div key={contact.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <h4 className="font-semibold text-gray-900">{contact.title}</h4>
                  <div className="space-y-2 mt-4 text-sm text-gray-600">
                    <p>{contact.email}</p>
                    <p>{contact.phone}</p>
                    <p>{contact.hours}</p>
                    <p>{contact.location}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

HelpSupportModule.messageTimeout = null;

export default HelpSupportModule;
