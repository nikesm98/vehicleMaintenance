import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserButton } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Truck, Search, RefreshCw, ArrowLeft, Plus, Battery, CircleDot,
  Calendar, User, Image as ImageIcon, ExternalLink, Loader2, FileText
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

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async (search = '') => {
    try {
      setLoading(true);
      const token = await getToken();
      const params = search ? `?vehicle=${encodeURIComponent(search)}` : '';
      const response = await axios.get(`${API}/maintenance/logs${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const countFilledTyres = (tyres) => {
    return tyres?.filter(t => t.number)?.length || 0;
  };

  const countPhotos = (log) => {
    let count = 0;
    if (log.battery1_photo_link) count++;
    if (log.battery2_photo_link) count++;
    count += log.prime_tyres?.filter(t => t.photo_link)?.length || 0;
    count += log.trailer_tyres?.filter(t => t.photo_link)?.length || 0;
    count += log.vehicle_images?.filter(v => v.photo_link)?.length || 0;
    return count;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="text-slate-600"
              data-testid="back-button"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#007BC1] flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#204788]" style={{ fontFamily: 'Space Grotesk' }}>Dashboard</h1>
                <p className="text-xs text-slate-500">Maintenance Logs</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate('/maintenance')}
              className="bg-[#007BC1] hover:bg-[#006299] text-white"
              data-testid="new-inspection-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">New Inspection</span>
            </Button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Search and Stats */}
      <div className="container mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
          <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by vehicle number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <Button type="submit" variant="outline" data-testid="search-button">
              Search
            </Button>
          </form>
          
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            data-testid="refresh-button"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#007BC1]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#007BC1]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#204788]" style={{ fontFamily: 'Space Grotesk' }}>{logs.length}</p>
                  <p className="text-xs text-slate-500">Total Logs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#204788]" style={{ fontFamily: 'Space Grotesk' }}>
                    {new Set(logs.map(l => l.vehicle_number)).size}
                  </p>
                  <p className="text-xs text-slate-500">Vehicles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <CircleDot className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#204788]" style={{ fontFamily: 'Space Grotesk' }}>
                    {logs.reduce((acc, log) => acc + countFilledTyres(log.prime_tyres) + countFilledTyres(log.trailer_tyres), 0)}
                  </p>
                  <p className="text-xs text-slate-500">Tyres Logged</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#204788]" style={{ fontFamily: 'Space Grotesk' }}>
                    {logs.reduce((acc, log) => acc + countPhotos(log), 0)}
                  </p>
                  <p className="text-xs text-slate-500">Photos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#007BC1]" />
          </div>
        ) : logs.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No maintenance logs found</h3>
              <p className="text-slate-500 mb-4">Start by creating a new inspection</p>
              <Button
                onClick={() => navigate('/maintenance')}
                className="bg-[#007BC1] hover:bg-[#006299] text-white"
                data-testid="empty-new-inspection-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Inspection
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {logs.map((log, index) => (
              <Card 
                key={log.record_id || index} 
                className="border-slate-200 hover:border-[#007BC1]/30 transition-all duration-200 hover:shadow-md"
                data-testid={`log-card-${index}`}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Main Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-[#204788] flex items-center justify-center">
                          <Truck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-[#204788]" style={{ fontFamily: 'Space Grotesk' }}>
                            {log.vehicle_number}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Calendar className="w-4 h-4" />
                            {formatDate(log.timestamp)}
                          </div>
                        </div>
                        {log.synced_to_sheets && (
                          <Badge className="ml-auto bg-green-100 text-green-700 hover:bg-green-100">
                            Synced
                          </Badge>
                        )}
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Batteries */}
                        <div className="p-3 bg-green-50 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Battery className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-medium text-green-700">Batteries</span>
                          </div>
                          <p className="text-sm text-slate-700">B1: {log.battery1_number || 'N/A'}</p>
                          <p className="text-sm text-slate-700">B2: {log.battery2_number || 'N/A'}</p>
                        </div>

                        {/* Prime Tyres */}
                        <div className="p-3 bg-amber-50 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <CircleDot className="w-4 h-4 text-amber-600" />
                            <span className="text-xs font-medium text-amber-700">Prime Tyres</span>
                          </div>
                          <p className="text-sm text-slate-700">
                            {countFilledTyres(log.prime_tyres)}/6 logged
                          </p>
                        </div>

                        {/* Trailer Tyres */}
                        <div className="p-3 bg-red-50 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <CircleDot className="w-4 h-4 text-red-600" />
                            <span className="text-xs font-medium text-red-700">Trailer Tyres</span>
                          </div>
                          <p className="text-sm text-slate-700">
                            {countFilledTyres(log.trailer_tyres)}/12 logged
                          </p>
                        </div>

                        {/* Photos */}
                        <div className="p-3 bg-blue-50 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <ImageIcon className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-medium text-blue-700">Photos</span>
                          </div>
                          <p className="text-sm text-slate-700">
                            {countPhotos(log)} uploaded
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Created By */}
                    <div className="lg:w-64 p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-medium text-slate-500">Created By</span>
                      </div>
                      <p className="text-sm font-medium text-slate-700">{log.created_by?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500 truncate">{log.created_by?.email || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Image Links */}
                  {(log.battery1_photo_link || log.battery2_photo_link || 
                    log.vehicle_images?.some(v => v.photo_link)) && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-xs font-medium text-slate-500 mb-2">Drive Links:</p>
                      <div className="flex flex-wrap gap-2">
                        {log.battery1_photo_link && (
                          <a
                            href={log.battery1_photo_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#007BC1] hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Battery 1
                          </a>
                        )}
                        {log.battery2_photo_link && (
                          <a
                            href={log.battery2_photo_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#007BC1] hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Battery 2
                          </a>
                        )}
                        {log.vehicle_images?.filter(v => v.photo_link).map((v, idx) => (
                          <a
                            key={idx}
                            href={v.photo_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#007BC1] hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {v.position}
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
