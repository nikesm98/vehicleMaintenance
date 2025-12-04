import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser, UserButton } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Truck, Battery, CircleDot, Camera, ArrowLeft, LayoutDashboard,
  Upload, X, CheckCircle2, Loader2, Image as ImageIcon
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Image upload component
const ImageUploader = ({ label, value, onChange, testId }) => {
  const inputRef = useRef(null);
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      <div 
        className="relative border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-[#007BC1]/50 transition-colors cursor-pointer bg-slate-50/50"
        onClick={() => inputRef.current?.click()}
        data-testid={testId}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        {value ? (
          <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-100">
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
              data-testid={`${testId}-remove`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-slate-400">
            <Camera className="w-10 h-10 mb-2" />
            <span className="text-sm">Click to capture or upload</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Tyre input component
const TyreInput = ({ position, index, type, value, photo, onNumberChange, onPhotoChange }) => {
  const inputRef = useRef(null);
  const isPrime = type === 'prime';
  const bgColor = isPrime ? 'bg-amber-50' : 'bg-red-50';
  const borderColor = isPrime ? 'border-amber-200' : 'border-red-200';
  const textColor = isPrime ? 'text-amber-700' : 'text-red-700';
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onPhotoChange(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={`p-4 rounded-xl ${bgColor} border ${borderColor}`}>
      <div className="flex items-center gap-2 mb-3">
        <CircleDot className={`w-5 h-5 ${textColor}`} />
        <span className={`font-medium ${textColor}`}>{position}</span>
      </div>
      <Input
        placeholder="Tyre Number"
        value={value}
        onChange={(e) => onNumberChange(e.target.value)}
        className="mb-3 bg-white"
        data-testid={`${type}-tyre-${index}-number`}
      />
      <div 
        className="relative border-2 border-dashed border-slate-300 rounded-lg p-2 hover:border-[#007BC1]/50 transition-colors cursor-pointer bg-white"
        onClick={() => inputRef.current?.click()}
        data-testid={`${type}-tyre-${index}-photo`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        {photo ? (
          <div className="relative aspect-square rounded-lg overflow-hidden">
            <img src={photo} alt="Tyre" className="w-full h-full object-cover" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPhotoChange(null);
              }}
              className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 text-slate-400">
            <Camera className="w-6 h-6 mb-1" />
            <span className="text-xs">Photo</span>
          </div>
        )}
      </div>
    </div>
  );
};

const MaintenanceForm = () => {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  
  // Form state
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [battery1Number, setBattery1Number] = useState('');
  const [battery1Photo, setBattery1Photo] = useState(null);
  const [battery2Number, setBattery2Number] = useState('');
  const [battery2Photo, setBattery2Photo] = useState(null);
  
  // Prime tyres (6)
  const primePositions = ['Front Left', 'Front Right', 'Rear Left Outer', 'Rear Left Inner', 'Rear Right Inner', 'Rear Right Outer'];
  const [primeTyres, setPrimeTyres] = useState(
    primePositions.map(pos => ({ position: pos, number: '', photo: null }))
  );
  
  // Trailer tyres (12)
  const trailerPositions = [
    'Axle 1 Left Outer', 'Axle 1 Left Inner', 'Axle 1 Right Inner', 'Axle 1 Right Outer',
    'Axle 2 Left Outer', 'Axle 2 Left Inner', 'Axle 2 Right Inner', 'Axle 2 Right Outer',
    'Axle 3 Left Outer', 'Axle 3 Left Inner', 'Axle 3 Right Inner', 'Axle 3 Right Outer'
  ];
  const [trailerTyres, setTrailerTyres] = useState(
    trailerPositions.map(pos => ({ position: pos, number: '', photo: null }))
  );
  
  // Vehicle images
  const vehicleImagePositions = ['Front', 'Left', 'Right', 'Rear'];
  const [vehicleImages, setVehicleImages] = useState(
    vehicleImagePositions.map(pos => ({ position: pos, photo: null }))
  );

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const response = await axios.get(`${API}/vehicles`);
      setVehicles(response.data.vehicles || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Failed to load vehicles');
    }
  };

  const handleSubmit = async () => {
    if (!vehicleNumber) {
      toast.error('Please select a vehicle number');
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      
      const payload = {
        vehicle_number: vehicleNumber,
        battery1_number: battery1Number,
        battery1_photo_base64: battery1Photo,
        battery2_number: battery2Number,
        battery2_photo_base64: battery2Photo,
        prime_tyres: primeTyres.map(t => ({
          position: t.position,
          number: t.number,
          photo_base64: t.photo
        })),
        trailer_tyres: trailerTyres.map(t => ({
          position: t.position,
          number: t.number,
          photo_base64: t.photo
        })),
        vehicle_images: vehicleImages.map(v => ({
          position: v.position,
          photo_base64: v.photo
        }))
      };

      const response = await axios.post(`${API}/maintenance/submit`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        toast.success('Maintenance log submitted successfully!');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit maintenance log');
    } finally {
      setLoading(false);
    }
  };

  const updatePrimeTyre = (index, field, value) => {
    setPrimeTyres(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const updateTrailerTyre = (index, field, value) => {
    setTrailerTyres(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const updateVehicleImage = (index, photo) => {
    setVehicleImages(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], photo };
      return updated;
    });
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
                <h1 className="text-lg font-bold text-[#204788]" style={{ fontFamily: 'Space Grotesk' }}>New Inspection</h1>
                <p className="text-xs text-slate-500">Vehicle Maintenance Form</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="hidden sm:flex"
              data-testid="dashboard-link"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Form Content */}
      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
        {/* Vehicle Selection */}
        <Card className="mb-6 border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-[#204788]" style={{ fontFamily: 'Space Grotesk' }}>
              <div className="w-10 h-10 rounded-xl bg-[#007BC1]/10 flex items-center justify-center">
                <Truck className="w-5 h-5 text-[#007BC1]" />
              </div>
              Vehicle Selection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Vehicle Number *</Label>
              <Select value={vehicleNumber} onValueChange={setVehicleNumber}>
                <SelectTrigger className="w-full" data-testid="vehicle-select">
                  <SelectValue placeholder="Select vehicle number" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle} value={vehicle}>
                      {vehicle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Battery Section */}
        <Card className="mb-6 border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-[#204788]" style={{ fontFamily: 'Space Grotesk' }}>
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Battery className="w-5 h-5 text-green-600" />
              </div>
              Battery Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Battery 1 */}
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl">
                <h4 className="font-medium text-slate-700">Battery 1</h4>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600">Battery Number</Label>
                  <Input
                    placeholder="Enter battery number"
                    value={battery1Number}
                    onChange={(e) => setBattery1Number(e.target.value)}
                    data-testid="battery1-number"
                  />
                </div>
                <ImageUploader
                  label="Battery Photo"
                  value={battery1Photo}
                  onChange={setBattery1Photo}
                  testId="battery1-photo"
                />
              </div>

              {/* Battery 2 */}
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl">
                <h4 className="font-medium text-slate-700">Battery 2</h4>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600">Battery Number</Label>
                  <Input
                    placeholder="Enter battery number"
                    value={battery2Number}
                    onChange={(e) => setBattery2Number(e.target.value)}
                    data-testid="battery2-number"
                  />
                </div>
                <ImageUploader
                  label="Battery Photo"
                  value={battery2Photo}
                  onChange={setBattery2Photo}
                  testId="battery2-photo"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Prime Tyres Section */}
        <Card className="mb-6 border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-[#204788]" style={{ fontFamily: 'Space Grotesk' }}>
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <CircleDot className="w-5 h-5 text-amber-600" />
              </div>
              Prime Tyres (6)
              <span className="text-xs font-normal text-slate-500 bg-amber-100 px-2 py-1 rounded-full">Main Vehicle</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {primeTyres.map((tyre, index) => (
                <TyreInput
                  key={index}
                  position={tyre.position}
                  index={index}
                  type="prime"
                  value={tyre.number}
                  photo={tyre.photo}
                  onNumberChange={(val) => updatePrimeTyre(index, 'number', val)}
                  onPhotoChange={(photo) => updatePrimeTyre(index, 'photo', photo)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Trailer Tyres Section */}
        <Card className="mb-6 border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-[#204788]" style={{ fontFamily: 'Space Grotesk' }}>
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <CircleDot className="w-5 h-5 text-red-600" />
              </div>
              Trailer Tyres (12)
              <span className="text-xs font-normal text-slate-500 bg-red-100 px-2 py-1 rounded-full">Trailer</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {trailerTyres.map((tyre, index) => (
                <TyreInput
                  key={index}
                  position={tyre.position}
                  index={index}
                  type="trailer"
                  value={tyre.number}
                  photo={tyre.photo}
                  onNumberChange={(val) => updateTrailerTyre(index, 'number', val)}
                  onPhotoChange={(photo) => updateTrailerTyre(index, 'photo', photo)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Images Section */}
        <Card className="mb-6 border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-[#204788]" style={{ fontFamily: 'Space Grotesk' }}>
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-blue-600" />
              </div>
              Vehicle Images
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {vehicleImages.map((img, index) => (
                <div key={index} className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">{img.position} View</Label>
                  <ImageUploader
                    label=""
                    value={img.photo}
                    onChange={(photo) => updateVehicleImage(index, photo)}
                    testId={`vehicle-image-${img.position.toLowerCase()}`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 pb-8">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            disabled={loading}
            data-testid="cancel-button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !vehicleNumber}
            className="bg-[#007BC1] hover:bg-[#006299] text-white px-8"
            data-testid="submit-button"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Submit Inspection
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default MaintenanceForm;
