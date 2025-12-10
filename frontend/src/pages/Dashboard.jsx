import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserButton } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';

import {
  Truck, Search, RefreshCw, ArrowLeft, Plus, Battery, CircleDot,
  Calendar, Image as ImageIcon, ExternalLink, Loader2, FileText
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  /* --------------------------------------------------------------- */
  /* FETCH LOGS */
  /* --------------------------------------------------------------- */
  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async (search = '') => {
    try {
      setLoading(true);
      const token = await getToken({ template: 'fleet_token' });
      const params = search ? `?vehicle=${encodeURIComponent(search)}` : '';

      const response = await axios.get(`${API}/maintenance/logs${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setLogs(response.data.logs || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to load maintenance logs');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs(searchQuery);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLogs(searchQuery);
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  /* --------------------------------------------------------------- */
  /* DATE FORMATTER */
  /* --------------------------------------------------------------- */
  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /* --------------------------------------------------------------- */
  /* COUNT PHOTOS — includes Odometer now */
  /* --------------------------------------------------------------- */
  const countPhotos = (log) => {
    let count = 0;

    if (log.battery1_photo_link) count++;
    if (log.battery2_photo_link) count++;
    if (log.odometer_photo_link) count++;    // ⭐ NEW — include odometer photo

    count += Array.isArray(log.prime_tyre_links)
      ? log.prime_tyre_links.filter((t) => t.photo_link).length
      : 0;

    count += Array.isArray(log.trailer_tyre_links)
      ? log.trailer_tyre_links.filter((t) => t.photo_link).length
      : 0;

    count += Array.isArray(log.vehicle_image_links)
      ? log.vehicle_image_links.filter((v) => v.photo_link).length
      : 0;

    return count;
  };

  /* --------------------------------------------------------------- */
  /* TYRE COUNT */
  /* --------------------------------------------------------------- */
  const countFilledTyres = (tyres) => {
    if (!Array.isArray(tyres)) return 0;
    return tyres.filter((t) => t.number && t.number.trim() !== '').length;
  };

  /* =============================================================== */
  /*                       RENDER STARTS HERE                       */
  /* =============================================================== */
  return (
    <div className="min-h-screen bg-slate-50">

      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-slate-600">
              <ArrowLeft className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-4">
              <div className="w-9 h-9 bg-[#007BC1] rounded-xl flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>

              <div>
                <h1 className="text-lg font-bold text-[#204788]">Dashboard</h1>
                <p className="text-xs text-slate-500">Maintenance Logs</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={() => navigate('/maintenance')} className="bg-[#007BC1] text-white">
              <Plus className="w-4 h-4 mr-2" /> New Inspection
            </Button>
            <UserButton afterSignOutUrl="/" />
          </div>

        </div>
      </header>

      {/* BODY */}
      <div className="container mx-auto px-4 py-6">

        {/* SEARCH */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6 mt-6">

          <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by vehicle number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">Search</Button>
          </form>

          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">

          {/* Total Logs */}
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-[#007BC1]/10 flex items-center justify-center rounded-xl">
                <FileText className="w-5 h-5 text-[#007BC1]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#204788]">{logs.length}</p>
                <p className="text-xs text-slate-500">Total Logs</p>
              </div>
            </CardContent>
          </Card>

          {/* Vehicles */}
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <Truck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#204788]">
                  {new Set(logs.map((l) => l.vehicle_number)).size}
                </p>
                <p className="text-xs text-slate-500">Vehicles</p>
              </div>
            </CardContent>
          </Card>

          {/* Tyres */}
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <CircleDot className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#204788]">
                  {logs.reduce(
                    (acc, log) =>
                      acc +
                      countFilledTyres(log.prime_tyres) +
                      countFilledTyres(log.trailer_tyres),
                    0
                  )}
                </p>
                <p className="text-xs text-slate-500">Tyres Logged</p>
              </div>
            </CardContent>
          </Card>

          {/* Photos */}
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#204788]">
                  {logs.reduce((acc, log) => acc + countPhotos(log), 0)}
                </p>
                <p className="text-xs text-slate-500">Photos</p>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* LOG LIST */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#007BC1]" />
          </div>
        ) : logs.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="w-10 h-10 mx-auto mb-4 text-slate-400" />
              <h3 className="text-lg font-semibold text-slate-700">No logs found</h3>
              <p className="text-slate-500 mb-4">Create a new inspection</p>
              <Button onClick={() => navigate('/maintenance')} className="bg-[#007BC1] text-white">
                <Plus className="w-4 h-4 mr-2" /> New Inspection
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {logs.map((log, index) => (
              <Card key={log.record_id || index} className="hover:shadow-md transition-all">
                <CardContent className="p-8">

                  <div className="flex flex-col lg:flex-row gap-6">

                    {/* LEFT PANEL */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-[#204788] rounded-xl flex items-center justify-center">
                          <Truck className="w-6 h-6 text-white" />
                        </div>

                        <div>
                          <h3 className="text-lg font-bold text-[#204788]">
                            {log.vehicle_number}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Calendar className="w-4 h-4" />
                            {formatDate(log.timestamp)}
                          </div>
                        </div>

                        {log.synced_to_sheets && (
                          <Badge className="ml-auto bg-green-100 text-green-700">Synced</Badge>
                        )}
                      </div>

                      {/* GRID INFO */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                        {/* Batteries */}
                        <div className="p-3 bg-green-50 rounded-xl">
                          <Battery className="w-4 h-4 text-green-600 mb-2" />
                          <p className="text-sm">B1: {log.battery1_number || 'N/A'}</p>
                          <p className="text-sm">B2: {log.battery2_number || 'N/A'}</p>
                        </div>

                        {/* Prime Tyres */}
                        <div className="p-3 bg-amber-50 rounded-xl">
                          <p className="text-sm font-medium text-amber-700 mb-1">Prime Tyres</p>
                          <p className="text-sm">{countFilledTyres(log.prime_tyres)}/6 logged</p>
                        </div>

                        {/* Trailer Tyres */}
                        <div className="p-3 bg-red-50 rounded-xl">
                          <p className="text-sm font-medium text-red-700 mb-1">Trailer Tyres</p>
                          <p className="text-sm">{countFilledTyres(log.trailer_tyres)}/12 logged</p>
                        </div>

                        {/* Photos */}
                        <div className="p-3 bg-blue-50 rounded-xl">
                          <p className="text-sm font-medium text-blue-700 mb-1">Photos</p>
                          <p className="text-sm">{countPhotos(log)} uploaded</p>
                        </div>

                        {/* ⭐ NEW — ODOMETER */}
                        <div className="p-3 bg-purple-50 rounded-xl">
                          <p className="text-sm font-medium text-purple-700 mb-1">Odometer</p>
                          <p className="text-sm">{log.odometer_value || "N/A"}</p>
                        </div>

                      </div>
                    </div>

                    {/* RIGHT PANEL */}
                    <div className="lg:w-64 p-4 bg-slate-50 border rounded-xl">
                      <p className="text-sm font-medium text-slate-500 mb-2">Created By</p>
                      <p className="text-sm font-medium text-slate-700">
                        {log.created_by?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {log.created_by?.email || 'N/A'}
                      </p>
                    </div>

                  </div>

                  {/* DRIVE LINKS */}
                  {(log.battery1_photo_link ||
                    log.battery2_photo_link ||
                    log.odometer_photo_link ||
                    (Array.isArray(log.vehicle_image_links) &&
                      log.vehicle_image_links.some((v) => v.photo_link))) && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs font-medium text-slate-500 mb-2">Drive Links:</p>

                      <div className="flex flex-wrap gap-2">

                        {log.battery1_photo_link && (
                          <a href={log.battery1_photo_link} target="_blank" className="text-xs text-[#007BC1] flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Battery 1
                          </a>
                        )}

                        {log.battery2_photo_link && (
                          <a href={log.battery2_photo_link} target="_blank" className="text-xs text-[#007BC1] flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Battery 2
                          </a>
                        )}

                        {/* ⭐ NEW — Odometer */}
                        {log.odometer_photo_link && (
                          <a href={log.odometer_photo_link} target="_blank" className="text-xs text-[#007BC1] flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Odometer
                          </a>
                        )}

                        {/* Vehicle images */}
                        {Array.isArray(log.vehicle_image_links) &&
                          log.vehicle_image_links
                            .filter((v) => v.photo_link)
                            .map((v, i) => (
                              <a
                                key={i}
                                href={v.photo_link}
                                target="_blank"
                                className="text-xs text-[#007BC1] flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" /> {v.position}
                              </a>
                            ))}
                      </div>
                    </div>
                  )}

                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;
