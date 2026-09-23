const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, default: null, trim: true },
    fileName: { type: String, default: null, trim: true },
    fileType: { type: String, default: null, trim: true },
    size: { type: Number, default: null },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: {
      type: String,
      enum: ['complainant', 'admin', 'superadmin', 'office_handler'],
      required: true,
    },
    authorName: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    source: {
      type: String,
      enum: ['ticket_submission', 'user_reply', 'support_reply'],
      default: 'user_reply',
    },
    attachments: { type: [attachmentSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true, trim: true },
    subject: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['filing', 'tracking', 'account', 'technical', 'privacy', 'general'],
      default: 'general',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
    },
    description: { type: String, required: true, trim: true },
    complainantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    complainantName: { type: String, required: true, trim: true },
    complainantEmail: { type: String, required: true, trim: true, lowercase: true },
    attachments: { type: [attachmentSchema], default: [] },
    messages: { type: [messageSchema], default: [] },
    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

supportTicketSchema.index({ complainantId: 1, lastActivityAt: -1 });
supportTicketSchema.index({ status: 1, lastActivityAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
