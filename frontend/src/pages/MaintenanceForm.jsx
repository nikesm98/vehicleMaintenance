import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser, UserButton } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import axios from 'axios';
import { toast } from 'sonner';

import {
  Truck, Battery, CircleDot, Camera, ArrowLeft, LayoutDashboard,
  X, CheckCircle2, Loader2, Image as ImageIcon, Check, ChevronsUpDown
} from 'lucide-react';

// 🔥 Searchable dropdown components
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/* --------------------------------------------
              IMAGE UPLOADER
--------------------------------------------- */
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
      reader.onloadend = () => onChange(reader.result);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>

      <div
        className="relative border-2 border-dashed border-slate-200 rounded-xl p-4
                   hover:border-[#007BC1]/50 transition-colors cursor-pointer bg-slate-50/50"
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

/* --------------------------------------------
              TYRE INPUT
--------------------------------------------- */
const TyreInput = ({ position, index, type, value, photo, onNumberChange, onPhotoChange }) => {
  const inputRef = useRef(null);
  const isPrime = type === 'prime';

  const colorClasses = {
    bg: isPrime ? 'bg-amber-50' : 'bg-red-50',
    border: isPrime ? 'border-amber-200' : 'border-red-200',
    text: isPrime ? 'text-amber-700' : 'text-red-700'
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => onPhotoChange(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className={`p-4 rounded-xl ${colorClasses.bg} border ${colorClasses.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <CircleDot className={`w-5 h-5 ${colorClasses.text}`} />
        <span className={`font-medium ${colorClasses.text}`}>{position}</span>
      </div>

      <Input
        placeholder="Tyre Number"
        value={value}
        onChange={(e) => onNumberChange(e.target.value)}
        className="mb-3 bg-white"
      />

      <div
        className="relative border-2 border-dashed border-slate-300 rounded-lg p-2
                   hover:border-[#007BC1]/50 transition-colors cursor-pointer bg-white"
        onClick={() => inputRef.current?.click()}
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

/* --------------------------------------------
           MAIN COMPONENT
--------------------------------------------- */
const MaintenanceForm = () => {
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);

  const [vehicleNumber, setVehicleNumber] = useState("");
  const [open, setOpen] = useState(false);

  const [battery1Number, setBattery1Number] = useState("");
  const [battery1Photo, setBattery1Photo] = useState(null);
  const [battery2Number, setBattery2Number] = useState("");
  const [battery2Photo, setBattery2Photo] = useState(null);

  const [odometerReading, setOdometerReading] = useState("");
  const [odometerPhoto, setOdometerPhoto] = useState(null);

  // Tyres
  const primePositions = ['Front Left', 'Front Right', 'Rear Left Outer', 'Rear Left Inner', 'Rear Right Inner', 'Rear Right Outer'];
  const trailerPositions = [
    'Axle 1 Left Outer', 'Axle 1 Left Inner', 'Axle 1 Right Inner', 'Axle 1 Right Outer',
    'Axle 2 Left Outer', 'Axle 2 Left Inner', 'Axle 2 Right Inner', 'Axle 2 Right Outer',
    'Axle 3 Left Outer', 'Axle 3 Left Inner', 'Axle 3 Right Inner', 'Axle 3 Right Outer'
  ];

  const [primeTyres, setPrimeTyres] = useState(primePositions.map(pos => ({ position: pos, number: '', photo: null })));
  const [trailerTyres, setTrailerTyres] = useState(trailerPositions.map(pos => ({ position: pos, number: '', photo: null })));

  const vehicleImagePositions = ['Front', 'Left', 'Right', 'Rear'];
  const [vehicleImages, setVehicleImages] = useState(vehicleImagePositions.map(pos => ({ position: pos, photo: null })));

  /* ----------------------------
      Fetch Vehicles
  ---------------------------- */
  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const response = await axios.get(`${API}/vehicles`);
      setVehicles(response.data.vehicles || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load vehicle list");
    }
  };

  /* ----------------------------
        Submit Handler
  ---------------------------- */
  const handleSubmit = async () => {
    if (!vehicleNumber) return toast.error("Please select a vehicle");

    setLoading(true);

    try {
      const token = await getToken({ template: "fleet_token" });

      const payload = {
        vehicle_number: vehicleNumber,
        battery1_number: battery1Number,
        battery1_photo_base64: battery1Photo,
        battery2_number: battery2Number,
        battery2_photo_base64: battery2Photo,
        odometer_value: odometerReading,
        odometer_photo_base64: odometerPhoto,
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

      const res = await axios.post(`${API}/maintenance/submit`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        toast.success("Maintenance log submitted!");
        navigate("/dashboard");
      }

    } catch (err) {
      console.error(err);
      toast.error("Failed to submit");
    }

    setLoading(false);
  };

  /* --------------------------------------------
                RETURN JSX
  --------------------------------------------- */
  return (
    <div className="min-h-screen bg-slate-50">
      
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#007BC1] flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>

              <div>
                <h1 className="text-lg font-bold text-[#204788]">New Inspection</h1>
                <p className="text-xs text-slate-500">Vehicle Maintenance Form</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="hidden sm:flex">
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <UserButton afterSignOutUrl="/" />
          </div>

        </div>
      </header>

      {/* FORM BODY */}
      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">

        {/* ----------------------------- */}
        {/* VEHICLE SELECTION */}
        {/* ----------------------------- */}
        <Card className="mb-6 border-slate-200 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-[#204788]">
              <div className="w-10 h-10 rounded-xl bg-[#007BC1]/10 flex items-center justify-center">
                <Truck className="w-5 h-5 text-[#007BC1]" />
              </div>
              Vehicle Selection
            </CardTitle>
          </CardHeader>

          <CardContent>
            <Label className="text-sm font-medium text-slate-700">Vehicle Number *</Label>

            {/* 🔥 SEARCHABLE DROPDOWN HERE */}
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between mt-2"
                >
                  {vehicleNumber || "Select vehicle number"}
                  <ChevronsUpDown className="w-4 h-4 opacity-50" />
                </Button>
              </PopoverTrigger>

              {/* ⭐ Full-width, aligned dropdown */}
              <PopoverContent
                align="start"
                className="w-[var(--radix-popover-trigger-width)] p-0"
              >
                <Command>

                  {/* ⭐ API search trigger */}
                  <CommandInput
                    placeholder="Search vehicle…"
                    onValueChange={(value) => fetchVehicles(value)}
                  />

                  <CommandList>
                    <CommandGroup heading="Vehicle Numbers">
                      {vehicles.map((v) => (
                        <CommandItem
                          key={v}
                          value={v}
                          onSelect={() => {
                            setVehicleNumber(v);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "w-4 h-4 mr-2",
                              v === vehicleNumber ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {v}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>

                </Command>
              </PopoverContent>
            </Popover>

          </CardContent>
        </Card>

        {/* -------------------------------- */}
        {/* BATTERY, TYRES & IMAGE COMPONENTS */}
        {/* -------------------------------- */}

        {/* BATTERY SECTION */}
        <Card className="mb-6 border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-[#204788]">
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

                <Label className="text-sm text-slate-600">Battery Number</Label>
                <Input
                  placeholder="Enter battery number"
                  value={battery1Number}
                  onChange={(e) => setBattery1Number(e.target.value)}
                />

                <ImageUploader
                  label="Battery Photo"
                  value={battery1Photo}
                  onChange={setBattery1Photo}
                />
              </div>

              {/* Battery 2 */}
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl">
                <h4 className="font-medium text-slate-700">Battery 2</h4>

                <Label className="text-sm text-slate-600">Battery Number</Label>
                <Input
                  placeholder="Enter battery number"
                  value={battery2Number}
                  onChange={(e) => setBattery2Number(e.target.value)}
                />

                <ImageUploader
                  label="Battery Photo"
                  value={battery2Photo}
                  onChange={setBattery2Photo}
                />
              </div>

            </div>
          </CardContent>
        </Card>

        {/* ODOMETER SECTION */}
        <Card className="mb-6 border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-[#204788]">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <CircleDot className="w-5 h-5 text-purple-600" />
              </div>
              Odometer Reading
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="w-full">  

              {/* Odometer Input */}
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl w-full">
                <Label className="text-sm text-slate-600">Odometer Value</Label>
                <Input
                  placeholder="Enter odometer reading"
                  value={odometerReading}
                  onChange={(e) => setOdometerReading(e.target.value)}
                />

                <ImageUploader
                  label="Odometer Photo"
                  value={odometerPhoto}
                  onChange={setOdometerPhoto}
                />
              </div>

            </div>
          </CardContent>
        </Card>


        {/* PRIME TYRES */}
        <Card className="mb-6 border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-[#204788]">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <CircleDot className="w-5 h-5 text-amber-600" />
              </div>
              Primer/Horse Tyres (6)
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {primeTyres.map((tyre, i) => (
                <TyreInput
                  key={i}
                  position={tyre.position}
                  index={i}
                  type="prime"
                  value={tyre.number}
                  photo={tyre.photo}
                  onNumberChange={(val) => {
                    const upd = [...primeTyres];
                    upd[i].number = val;
                    setPrimeTyres(upd);
                  }}
                  onPhotoChange={(photo) => {
                    const upd = [...primeTyres];
                    upd[i].photo = photo;
                    setPrimeTyres(upd);
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* TRAILER TYRES */}
        <Card className="mb-6 border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-[#204788]">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <CircleDot className="w-5 h-5 text-red-600" />
              </div>
              Trailer Tyres (12)
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {trailerTyres.map((tyre, i) => (
                <TyreInput
                  key={i}
                  position={tyre.position}
                  index={i}
                  type="trailer"
                  value={tyre.number}
                  photo={tyre.photo}
                  onNumberChange={(val) => {
                    const upd = [...trailerTyres];
                    upd[i].number = val;
                    setTrailerTyres(upd);
                  }}
                  onPhotoChange={(photo) => {
                    const upd = [...trailerTyres];
                    upd[i].photo = photo;
                    setTrailerTyres(upd);
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* VEHICLE IMAGES */}
        <Card className="mb-6 border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-[#204788]">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-blue-600" />
              </div>
              Vehicle Images
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {vehicleImages.map((img, i) => (
                <div key={i} className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">{img.position} View</Label>
                  <ImageUploader
                    label=""
                    value={img.photo}
                    onChange={(photo) => {
                      const upd = [...vehicleImages];
                      upd[i].photo = photo;
                      setVehicleImages(upd);
                    }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* SUBMIT BUTTON */}
        <div className="flex justify-end gap-4 pb-8">
          <Button variant="outline" onClick={() => navigate("/")}>Cancel</Button>

          <Button
            onClick={handleSubmit}
            disabled={loading || !vehicleNumber}
            className="bg-[#007BC1] text-white px-8"
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
