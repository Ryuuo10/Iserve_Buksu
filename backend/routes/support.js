const express = require('express');
const router = express.Router();
const SupportTicket = require('../models/SupportTicket');
const { authenticateToken, checkRole } = require('../middleware/auth');

const ALLOWED_CATEGORIES = new Set(['filing', 'tracking', 'account', 'technical', 'privacy', 'general']);
const ALLOWED_PRIORITIES = new Set(['low', 'medium', 'high']);
const ELEVATED_ROLES = new Set(['admin', 'superadmin']);

const buildTicketId = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `SUP-${year}-${random}`;
};

const sanitizeText = (value) => String(value || '').trim();

const sanitizeAttachments = (attachments) => {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .filter((attachment) => attachment && attachment.url)
    .map((attachment) => ({
      url: sanitizeText(attachment.url),
      publicId: sanitizeText(attachment.publicId) || null,
      fileName: sanitizeText(attachment.fileName || attachment.originalName) || null,
      fileType: sanitizeText(attachment.fileType || attachment.format) || null,
      size: Number.isFinite(attachment.size) ? attachment.size : null,
    }));
};

const normalizeCategory = (category) => {
  const candidate = sanitizeText(category).toLowerCase();
  return ALLOWED_CATEGORIES.has(candidate) ? candidate : 'general';
};

const normalizePriority = (priority) => {
  const candidate = sanitizeText(priority).toLowerCase();
  return ALLOWED_PRIORITIES.has(candidate) ? candidate : 'medium';
};

const canAccessTicket = (user, ticket) => {
  if (!user || !ticket) {
    return false;
  }

  if (ELEVATED_ROLES.has(user.role)) {
    return true;
  }

  return String(ticket.complainantId) === String(user._id);
};

const createUniqueTicketId = async () => {
  let ticketId = buildTicketId();
  while (await SupportTicket.exists({ ticketId })) {
    ticketId = buildTicketId();
  }

  return ticketId;
};

router.get('/tickets', authenticateToken, checkRole('complainant', 'admin', 'superadmin'), async (req, res) => {
  try {
    const filter = ELEVATED_ROLES.has(req.user.role)
      ? {}
      : { complainantId: req.user._id };

    const tickets = await SupportTicket.find(filter)
      .sort({ lastActivityAt: -1, createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      success: true,
      tickets,
    });
  } catch (error) {
    console.error('Failed to load support tickets:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load support tickets',
    });
  }
});

router.get('/tickets/:ticketId', authenticateToken, checkRole('complainant', 'admin', 'superadmin'), async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({ ticketId: sanitizeText(req.params.ticketId) }).lean();

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found',
      });
    }

    if (!canAccessTicket(req.user, ticket)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this support ticket',
      });
    }

    return res.json({
      success: true,
      ticket,
    });
  } catch (error) {
    console.error('Failed to load support ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load support ticket',
    });
  }
});

router.post('/tickets', authenticateToken, checkRole('complainant', 'admin', 'superadmin'), async (req, res) => {
  try {
    const subject = sanitizeText(req.body.subject);
    const description = sanitizeText(req.body.description);
    const category = normalizeCategory(req.body.category);
    const priority = normalizePriority(req.body.priority);
    const attachments = sanitizeAttachments(req.body.attachments);

    if (!subject || !description) {
      return res.status(400).json({
        success: false,
        message: 'Subject and description are required',
      });
    }

    const ticketId = await createUniqueTicketId();

    const ticket = await SupportTicket.create({
      ticketId,
      subject,
      category,
      priority,
      status: 'open',
      description,
      complainantId: req.user._id,
      complainantName: sanitizeText(req.user.name),
      complainantEmail: sanitizeText(req.user.email).toLowerCase(),
      attachments,
      messages: [
        {
          authorId: req.user._id,
          authorRole: req.user.role,
          authorName: sanitizeText(req.user.name),
          message: description,
          source: 'ticket_submission',
          attachments,
        },
      ],
      lastActivityAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      ticket,
    });
  } catch (error) {
    console.error('Failed to create support ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create support ticket',
    });
  }
});

router.post('/tickets/:ticketId/messages', authenticateToken, checkRole('complainant', 'admin', 'superadmin'), async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({ ticketId: sanitizeText(req.params.ticketId) });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found',
      });
    }

    if (!canAccessTicket(req.user, ticket)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this support ticket',
      });
    }

    const message = sanitizeText(req.body.message);
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    const attachments = sanitizeAttachments(req.body.attachments);

    ticket.messages.push({
      authorId: req.user._id,
      authorRole: req.user.role,
      authorName: sanitizeText(req.user.name),
      message,
      source: ELEVATED_ROLES.has(req.user.role) ? 'support_reply' : 'user_reply',
      attachments,
      createdAt: new Date(),
    });
    ticket.lastActivityAt = new Date();

    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      ticket.status = 'open';
    }

    await ticket.save();

    return res.json({
      success: true,
      message: 'Ticket updated successfully',
      ticket,
    });
  } catch (error) {
    console.error('Failed to update support ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update support ticket',
    });
  }
});

module.exports = router;
