/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle, Clock, Plus, Send } from "lucide-react";

export function SupportTickets() {
  useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ title: "", description: "", priority: "normal" });
  const [replyText, setReplyText] = useState("");

  // Fetch user's tickets
  const { data: ticketsData, isLoading: ticketsLoading, refetch: refetchTickets } = 
    trpc.support.getMyTickets.useQuery();

  // Fetch selected ticket details
  const { data: ticketDetail } = 
    trpc.support.getTicketDetails.useQuery(
      { ticketId: selectedTicketId || 0 },
      { enabled: !!selectedTicketId }
    );

  // Create ticket mutation
  const createTicketMutation = trpc.support.createTicket.useMutation({
    onSuccess: () => {
      setFormData({ title: "", description: "", priority: "normal" });
      setShowCreateForm(false);
      refetchTickets();
    },
  });

  // Add reply mutation
  const addReplyMutation = trpc.support.addReply.useMutation({
    onSuccess: () => {
      setReplyText("");
      if (selectedTicketId) {
        trpc.useUtils().support.getTicketDetails.invalidate({ ticketId: selectedTicketId });
      }
    },
  });

  const handleCreateTicket = () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      alert("Please fill in all fields");
      return;
    }

    createTicketMutation.mutate({
      subject: formData.title,
      description: formData.description,
      category: "other" as const,
      priority: formData.priority as "low" | "medium" | "high" | "urgent",
    });
  };

  const handleAddReply = () => {
    if (!replyText.trim() || !selectedTicketId) return;

    addReplyMutation.mutate({
      ticketId: selectedTicketId,
      message: replyText,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "resolved":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "in_progress":
        return <Clock className="w-4 h-4 text-blue-500" />;
      case "closed":
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "normal":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Support Tickets</h1>
            <p className="text-gray-600 mt-2">Manage your support requests</p>
          </div>
          <Button onClick={() => setShowCreateForm(!showCreateForm)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Ticket
          </Button>
        </div>

        {/* Create Ticket Form */}
        {showCreateForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Create Support Ticket</CardTitle>
              <CardDescription>Describe your issue and we'll help you resolve it</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <Input
                  placeholder="Brief description of your issue"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  placeholder="Provide detailed information about your issue"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleCreateTicket}
                  disabled={createTicketMutation.isPending}
                >
                  {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tickets List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Your Tickets</CardTitle>
                <CardDescription>{Array.isArray(ticketsData) ? ticketsData.length : 0} total</CardDescription>
              </CardHeader>
              <CardContent>
                {ticketsLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading tickets...</div>
                ) : Array.isArray(ticketsData) && ticketsData.length > 0 ? (
                  <div className="space-y-2">
                    {Array.isArray(ticketsData) && ticketsData.map((ticket: any) => (
                      <button
                        key={ticket.id}
                        onClick={() => setSelectedTicketId(ticket.id)}
                        className={`w-full text-left p-3 rounded-lg border transition ${
                          selectedTicketId === ticket.id
                            ? "bg-blue-50 border-blue-300"
                            : "hover:bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">{ticket.title}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(ticket.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          {getStatusIcon(ticket.status)}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No tickets yet</p>
                    <p className="text-sm mt-2">Create one to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Ticket Details */}
          <div className="lg:col-span-2">
            {selectedTicketId && ticketDetail ? (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{ticketDetail.ticket?.subject}</CardTitle>
                      <CardDescription className="mt-2">
                        Created {new Date(ticketDetail.ticket?.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={getPriorityColor(ticketDetail.ticket?.priority)}>
                        {ticketDetail.ticket?.priority}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        {getStatusIcon(ticketDetail.ticket?.status)}
                        {ticketDetail.ticket?.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Original Issue */}
                  <div>
                    <h3 className="font-semibold mb-2">Issue Description</h3>
                    <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                      {ticketDetail.ticket?.description}
                    </p>
                  </div>

                  {/* Replies */}
                  {ticketDetail.replies && ticketDetail.replies.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3">Responses</h3>
                      <div className="space-y-3">
                        {ticketDetail.replies.map((reply: any) => (
                          <div
                            key={reply.id}
                            className={`p-3 rounded-lg ${
                              reply.isStaffReply
                                ? "bg-blue-50 border border-blue-200"
                                : "bg-gray-50 border border-gray-200"
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <p className="font-medium text-sm">
                                {reply.isStaffReply ? "Support Team" : "You"}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(reply.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <p className="text-sm text-gray-700">{reply.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reply Form */}
                  {ticketDetail.ticket?.status !== "closed" && (
                    <div>
                      <h3 className="font-semibold mb-2">Add Reply</h3>
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Type your reply..."
                          rows={3}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                        />
                        <Button
                          onClick={handleAddReply}
                          disabled={addReplyMutation.isPending || !replyText.trim()}
                          className="flex items-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          {addReplyMutation.isPending ? "Sending..." : "Send Reply"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-gray-500">
                    <p>Select a ticket to view details</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}