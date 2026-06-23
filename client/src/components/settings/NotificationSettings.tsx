/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function NotificationSettings() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [emailFrequency, setEmailFrequency] = useState<"immediate" | "daily" | "weekly" | "never">("daily");
  const [pushNotifications, setPushNotifications] = useState(true);
  const [pushFrequency, setPushFrequency] = useState<"immediate" | "daily" | "weekly" | "never">("immediate");
  const [notifyOnNewTrends, setNotifyOnNewTrends] = useState(true);
  const [notifyOnScheduledPosts, setNotifyOnScheduledPosts] = useState(true);
  const [notifyOnPublishedPosts, setNotifyOnPublishedPosts] = useState(true);
  const [notifyOnFailedPosts, setNotifyOnFailedPosts] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("08:00");

  const handleSave = () => {
    toast.success("Notification settings saved successfully");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>Configure how you receive email notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-notifications">Enable Email Notifications</Label>
            <Switch
              id="email-notifications"
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>

          {emailNotifications && (
            <div className="space-y-2">
              <Label htmlFor="email-frequency">Email Frequency</Label>
              <Select value={emailFrequency} onValueChange={(value: any) => setEmailFrequency(value)}>
                <SelectTrigger id="email-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="daily">Daily Digest</SelectItem>
                  <SelectItem value="weekly">Weekly Digest</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Push Notifications</CardTitle>
          <CardDescription>Configure push notifications on your devices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="push-notifications">Enable Push Notifications</Label>
            <Switch
              id="push-notifications"
              checked={pushNotifications}
              onCheckedChange={setPushNotifications}
            />
          </div>

          {pushNotifications && (
            <div className="space-y-2">
              <Label htmlFor="push-frequency">Push Frequency</Label>
              <Select value={pushFrequency} onValueChange={(value: any) => setPushFrequency(value)}>
                <SelectTrigger id="push-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Choose what events trigger notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="notify-trends">Notify on New Trends</Label>
            <Switch
              id="notify-trends"
              checked={notifyOnNewTrends}
              onCheckedChange={setNotifyOnNewTrends}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="notify-scheduled">Notify on Scheduled Posts</Label>
            <Switch
              id="notify-scheduled"
              checked={notifyOnScheduledPosts}
              onCheckedChange={setNotifyOnScheduledPosts}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="notify-published">Notify on Published Posts</Label>
            <Switch
              id="notify-published"
              checked={notifyOnPublishedPosts}
              onCheckedChange={setNotifyOnPublishedPosts}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="notify-failed">Notify on Failed Posts</Label>
            <Switch
              id="notify-failed"
              checked={notifyOnFailedPosts}
              onCheckedChange={setNotifyOnFailedPosts}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quiet Hours</CardTitle>
          <CardDescription>Don't send notifications during these hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="quiet-hours">Enable Quiet Hours</Label>
            <Switch
              id="quiet-hours"
              checked={quietHoursEnabled}
              onCheckedChange={setQuietHoursEnabled}
            />
          </div>

          {quietHoursEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quiet-start">Start Time</Label>
                <input
                  id="quiet-start"
                  type="time"
                  value={quietHoursStart}
                  onChange={(e) => setQuietHoursStart(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiet-end">End Time</Label>
                <input
                  id="quiet-end"
                  type="time"
                  value={quietHoursEnd}
                  onChange={(e) => setQuietHoursEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full">
        Save Notification Settings
      </Button>
    </div>
  );
}