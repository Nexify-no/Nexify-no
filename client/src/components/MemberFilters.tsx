/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, X } from "lucide-react";
import { useState, useEffect } from "react";

export interface MemberFiltersState {
  search: string;
  status: "all" | "active" | "inactive";
  role: "all" | "admin" | "user";
  subscriptionStatus: "all" | "trial" | "active" | "cancelled" | "expired";
  joinDateFrom: string;
  joinDateTo: string;
}

interface MemberFiltersProps {
  onFiltersChange: (filters: MemberFiltersState) => void;
  onReset: () => void;
}

const DEFAULT_FILTERS: MemberFiltersState = {
  search: "",
  status: "all",
  role: "all",
  subscriptionStatus: "all",
  joinDateFrom: "",
  joinDateTo: "",
};

export function MemberFilters({ onFiltersChange, onReset }: MemberFiltersProps) {
  const [filters, setFilters] = useState<MemberFiltersState>(DEFAULT_FILTERS);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  // Load filters from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("memberFilters");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFilters(parsed);
        checkActiveFilters(parsed);
      } catch {
        localStorage.removeItem("memberFilters");
      }
    }
  }, []);

  // Save filters to localStorage
  useEffect(() => {
    localStorage.setItem("memberFilters", JSON.stringify(filters));
    checkActiveFilters(filters);
    onFiltersChange(filters);
  }, [filters, onFiltersChange]);

  const checkActiveFilters = (f: MemberFiltersState) => {
    const hasActive =
      f.search !== "" ||
      f.status !== "all" ||
      f.role !== "all" ||
      f.subscriptionStatus !== "all" ||
      f.joinDateFrom !== "" ||
      f.joinDateTo !== "";
    setHasActiveFilters(hasActive);
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    localStorage.removeItem("memberFilters");
    onReset();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Advanced Filters
        </CardTitle>
        <CardDescription>
          Search and filter members by various criteria
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Status Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Member Status</label>
            <Select value={filters.status} onValueChange={(value: any) => setFilters({ ...filters, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Role Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Role</label>
            <Select value={filters.role} onValueChange={(value: any) => setFilters({ ...filters, role: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subscription Status Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Subscription</label>
            <Select value={filters.subscriptionStatus} onValueChange={(value: any) => setFilters({ ...filters, subscriptionStatus: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Join Date Range */}
          <div>
            <label className="text-sm font-medium mb-2 block">Join Date Range</label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={filters.joinDateFrom}
                onChange={(e) => setFilters({ ...filters, joinDateFrom: e.target.value })}
                className="text-sm"
              />
              <Input
                type="date"
                value={filters.joinDateTo}
                onChange={(e) => setFilters({ ...filters, joinDateTo: e.target.value })}
                className="text-sm"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end">
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={handleReset}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Reset Filters
            </Button>
          )}
          <Button className="bg-blue-600 hover:bg-blue-700">
            Apply Filters
          </Button>
        </div>

        {/* Active Filters Info */}
        {hasActiveFilters && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm text-blue-900 dark:text-blue-100">
            ℹ️ Filters are active and saved. Reload the page to see your saved filters.
          </div>
        )}
      </CardContent>
    </Card>
  );
}