/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Calendar, Users, MessageSquare } from 'lucide-react';

interface ProgressData {
  date: string;
  posts: number;
  engagement: number;
  reach: number;
}

interface PlatformStats {
  platform: string;
  posts: number;
  engagement: number;
  followers: number;
}

const Progress: React.FC = () => {
  useState<'week' | 'month' | 'year'>('month');

  // Sample data - in production, this would come from the API
  const progressData: ProgressData[] = [
    { date: 'Jan 1', posts: 2, engagement: 45, reach: 120 },
    { date: 'Jan 8', posts: 4, engagement: 89, reach: 280 },
    { date: 'Jan 15', posts: 6, engagement: 156, reach: 420 },
    { date: 'Jan 22', posts: 8, engagement: 234, reach: 580 },
    { date: 'Jan 29', posts: 10, engagement: 312, reach: 750 },
    { date: 'Feb 5', posts: 12, engagement: 421, reach: 920 },
    { date: 'Feb 12', posts: 14, engagement: 534, reach: 1150 },
  ];

  const platformStats: PlatformStats[] = [
    { platform: 'LinkedIn', posts: 28, engagement: 1240, followers: 2500 },
    { platform: 'Twitter', posts: 45, engagement: 890, followers: 1800 },
    { platform: 'Facebook', posts: 22, engagement: 650, followers: 3200 },
    { platform: 'Instagram', posts: 35, engagement: 2100, followers: 4500 },
  ];

  const engagementByPlatform = platformStats.map(p => ({
    name: p.platform,
    value: p.engagement
  }));

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'];

  const stats = [
    {
      title: 'Total Posts',
      value: '130',
      change: '+12%',
      icon: Calendar,
      color: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      title: 'Total Engagement',
      value: '4,815',
      change: '+23%',
      icon: MessageSquare,
      color: 'bg-purple-50',
      textColor: 'text-purple-600'
    },
    {
      title: 'Total Reach',
      value: '12,500',
      change: '+18%',
      icon: Users,
      color: 'bg-green-50',
      textColor: 'text-green-600'
    },
    {
      title: 'Avg Engagement Rate',
      value: '3.8%',
      change: '+0.5%',
      icon: TrendingUp,
      color: 'bg-orange-50',
      textColor: 'text-orange-600'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Din Fremgang</h1>
          <p className="text-gray-600 mt-2">Overvåk dine innlegg, engasjement og vekst på tvers av plattformer</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
                    <div className={`${stat.color} p-2 rounded-lg`}>
                      <Icon className={`w-5 h-5 ${stat.textColor}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
                    <span className="text-sm text-green-600 font-medium">{stat.change}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Oversikt</TabsTrigger>
            <TabsTrigger value="platforms">Plattformer</TabsTrigger>
            <TabsTrigger value="engagement">Engasjement</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Innlegg Over Tid</CardTitle>
                <CardDescription>Antall innlegg publisert per uke</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="posts" stroke="#3b82f6" strokeWidth={2} name="Innlegg" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rekkevidde Over Tid</CardTitle>
                <CardDescription>Totalt antall mennesker nådd</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="reach" fill="#10b981" name="Rekkevidde" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Platforms Tab */}
          <TabsContent value="platforms" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {platformStats.map((platform, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-lg">{platform.platform}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Innlegg</span>
                        <span className="font-semibold text-gray-900">{platform.posts}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(platform.posts / 50) * 100}%` }}></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Engasjement</span>
                        <span className="font-semibold text-gray-900">{platform.engagement}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${(platform.engagement / 2500) * 100}%` }}></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Følgere</span>
                        <span className="font-semibold text-gray-900">{platform.followers.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(platform.followers / 5000) * 100}%` }}></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Engagement Tab */}
          <TabsContent value="engagement">
            <Card>
              <CardHeader>
                <CardTitle>Engasjement Per Plattform</CardTitle>
                <CardDescription>Sammenligning av engasjement på tvers av plattformer</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={engagementByPlatform}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {engagementByPlatform.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-4">
                    {platformStats.map((platform, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                          <span className="font-medium text-gray-900">{platform.platform}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-600">{platform.engagement}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Additional Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Best Performing Post</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">2,450</p>
              <p className="text-sm text-gray-600 mt-2">Engasjement på LinkedIn</p>
              <p className="text-xs text-gray-500 mt-2">Publisert 5 dager siden</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Best Time to Post</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">09:00 AM</p>
              <p className="text-sm text-gray-600 mt-2">Høyeste engasjement</p>
              <p className="text-xs text-gray-500 mt-2">Basert på 130 innlegg</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Growth Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">+18%</p>
              <p className="text-sm text-gray-600 mt-2">Denne måneden</p>
              <p className="text-xs text-gray-500 mt-2">Sammenlignet med forrige måned</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Progress;