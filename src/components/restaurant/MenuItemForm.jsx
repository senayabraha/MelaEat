import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { Upload } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function MenuItemForm({ open, onClose, onSave, item, categories, restaurantId }) {
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setForm(item || { restaurant_id: restaurantId, name: '', description: '', price: 0, in_stock: true, is_featured: false, is_vegetarian: false, is_spicy: false, category_id: categories[0]?.id });
    }
  }, [open, item, restaurantId, categories]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm({ ...form, image_url: file_url });
    } catch (error) {
      toast({ title: 'Upload failed', description: error.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const payload = { ...form, price: Number(form.price) };
    if (form.id) {
      await base44.entities.MenuItem.update(form.id, payload);
    } else {
      await base44.entities.MenuItem.create(payload);
    }
    onSave();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form.id ? 'Edit item' : 'New item'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Image</Label>
            <div className="flex items-center gap-3">
              {form.image_url && <img src={form.image_url} alt="" className="w-20 h-20 rounded-lg object-cover" />}
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border cursor-pointer hover:bg-secondary text-sm">
                <Upload className="w-4 h-4" /> {uploading ? 'Uploading…' : 'Upload'}
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </label>
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Name</Label>
            <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label className="mb-2 block">Description</Label>
            <Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-2 block">Price (ETB)</Label>
              <Input type="number" value={form.price || 0} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <Label className="mb-2 block">Category</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ToggleRow label="In stock" value={form.in_stock} onChange={(v) => setForm({ ...form, in_stock: v })} />
            <ToggleRow label="Featured" value={form.is_featured} onChange={(v) => setForm({ ...form, is_featured: v })} />
            <ToggleRow label="Vegetarian" value={form.is_vegetarian} onChange={(v) => setForm({ ...form, is_vegetarian: v })} />
            <ToggleRow label="Spicy" value={form.is_spicy} onChange={(v) => setForm({ ...form, is_spicy: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{form.id ? 'Save' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={!!value} onCheckedChange={onChange} />
    </div>
  );
}
