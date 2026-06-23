/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle, Clock, MessageSquare } from "lucide-react";

export function AdminSupport() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);

  // Redirect if not admin
  useEffect(() => {
    if (user && (user as any).role !== "admin") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  // Fetch all support tickets
  const { data: ticketsData, isLoading: ticketsLoading, refetch: refetchTickets } = 
    trpc.support.getAllTickets.useQuery(
      undefined,
      { enabled: (user as any)?.role === "admin" }
    );

  // Fetch selected ticket details
  const { data: ticketDetail } = 
    trpc.support.getTicketDetails.useQuery(
      { ticketId: selectedTicketId || 0 },
      { enabled: !!selectedTicketId }
    );

  // Update ticket status mutation
  const updateStatusMutation = trpc.support.updateTicketStatus.useMutation({
    onSuccess: () => {
      refetchTickets();
      if (selectedTicketId) {
        trpc.useUtils().support.getTicketDetails.invalidate({ ticketId: selectedTicketId });
      }
    },
  });

  // Add reply mutation
  const addReplyMutation = trpc.support.addReply.useMutation({
    onSuccess: () => {
      if (selectedTicketId) {
        trpc.useUtils().support.getTicketDetails.invalidate({ ticketId: selectedTicketId });
      }
    },
  });

  // Get statistics
  const stats = {
    total: Array.isArray(ticketsData) ? ticketsData.length : 0,
    open: Array.isArray(ticketsData) ? ticketsData.filter((t: any) => t.status === "open").length : 0,
    inProgress: Array.isArray(ticketsData) ? ticketsData.filter((t: any) => t.status === "in_progress").length : 0,
    resolved: Array.isArray(ticketsData) ? ticketsData.filter((t: any) => t.status === "resolved").length : 0,
  };

  if (!user || (user as any).role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-gray-600 mt-2">You don't have permission to access this page</p>
        </div>
      </div>
    );
  }

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
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Support Tickets Management</h1>
          <p className="text-gray-600 mt-2">Manage all customer support tickets</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{stats.total}</p>
                <p className="text-gray-600 text-sm mt-1">Total Tickets</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-600">{stats.open}</p>
                <p className="text-gray-600 text-sm mt-1">Open</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{stats.inProgress}</p>
                <p className="text-gray-600 text-sm mt-1">In Progress</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{stats.resolved}</p>
                <p className="text-gray-600 text-sm mt-1">Resolved</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={filterStatus === undefined ? "default" : "outline"}
            onClick={() => setFilterStatus(undefined)}
          >
            All Tickets
          </Button>
          <Button
            variant={filterStatus === "open" ? "default" : "outline"}
            onClick={() => setFilterStatus("open")}
          >
            Open
          </Button>
          <Button
            variant={filterStatus === "in_progress" ? "default" : "outline"}
            onClick={() => setFilterStatus("in_progress")}
          >
            In Progress
          </Button>
          <Button
            variant={filterStatus === "resolved" ? "default" : "outline"}
            onClick={() => setFilterStatus("resolved")}
          >
            Resolved
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tickets List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Tickets</CardTitle>
                <CardDescription>{Array.isArray(ticketsData) ? ticketsData.length : 0} total</CardDescription>
              </CardHeader>
              <CardContent>
                {ticketsLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading tickets...</div>
                ) : Array.isArray(ticketsData) && ticketsData.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {ticketsData.map((ticket: any) => (
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
                            <div className="flex gap-1 mt-1">
                              <Badge className={`text-xs ${getPriorityColor(ticket.priority)}`}>
                                {ticket.priority}
                              </Badge>
                            </div>
                          </div>
                          {getStatusIcon(ticket.status)}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No tickets found</p>
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
                        From: {ticketDetail.ticket?.userId}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={getPriorityColor(ticketDetail.ticket?.priority)}>
                        {ticketDetail.ticket?.priority}
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

                  {/* Status Update */}
                  <div>
                    <h3 className="font-semibold mb-2">Update Status</h3>
                    <div className="flex gap-2">
                      {["open", "in_progress", "resolved", "closed"].map((status) => (
                        <Button
                          key={status}
                          variant={ticketDetail.ticket?.status === status ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              ticketId: selectedTicketId,
                              status: status as any,
                            })
                          }
                          disabled={updateStatusMutation.isPending}
                        >
                          {status.replace("_", " ")}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Replies */}
                  {ticketDetail.replies && ticketDetail.replies.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3">Conversation</h3>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
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
                                {reply.isStaffReply ? "Support Team" : "Customer"}
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

                  {/* Quick Reply */}
                  <div>
                    <h3 className="font-semibold mb-2">Send Reply</h3>
                    <div className="space-y-2">
                      <textarea
                        placeholder="Type your response..."
                        rows={3}
                        className="w-full px-3 py-2 border rounded-md"
                        id="reply-text"
                      />
                      <Button
                        onClick={() => {
                          const textarea = document.getElementById("reply-text") as HTMLTextAreaElement;
                          if (textarea.value.trim()) {
                            addReplyMutation.mutate({
                              ticketId: selectedTicketId,
                              message: textarea.value,
                            });
                            textarea.value = "";
                          }
                        }}
                        disabled={addReplyMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        {addReplyMutation.isPending ? "Sending..." : "Send Reply"}
                      </Button>
                    </div>
                  </div>
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