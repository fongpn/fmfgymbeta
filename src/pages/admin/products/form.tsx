import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { supabase } from '../../../lib/supabase';
import { Product } from '../../../types';
import { compressImage } from '../../../lib/utils';
import toast from 'react-hot-toast';

interface ProductFormProps {
  onSuccess: () => void;
}

export default function ProductForm({ onSuccess }: ProductFormProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    active: true,
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');

  useEffect(() => {
    if (id) {
      fetchProduct();
    } else {
      setLoading(false);
    }
  }, [id]);

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setFormData(data);
      if (data.photo_url) {
        setPhotoPreview(data.photo_url);
      }
    } catch (error) {
      toast.error('Error fetching product');
      navigate('/admin/products');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBlob = await compressImage(file);
        const compressedFile = new File([compressedBlob], file.name, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });

        setPhoto(compressedFile);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotoPreview(reader.result as string);
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        toast.error('Error processing image');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let photoUrl = formData.photo_url || '';

      // Upload photo if provided
      if (photo) {
        const fileExt = 'jpg';
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `products/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, photo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        photoUrl = publicUrl;
      }

      // Ensure all required fields are present and properly formatted
      const productData = {
        name: formData.name || '',
        description: formData.description || '',
        price: Number(formData.price) || 0,
        stock: Number(formData.stock) || 0,
        active: formData.active !== undefined ? formData.active : true,
        photo_url: photoUrl
      };

      console.log('Saving product data:', productData);

      if (id) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', id);

        if (error) {
          console.error('Error updating product:', error);
          throw error;
        }

        toast.success('Product updated successfully');
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert(productData)
          .select();

        if (error) {
          console.error('Error creating product:', error);
          throw error;
        }

        console.log('Product created successfully:', data);
        toast.success('Product created successfully');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error(id ? 'Error updating product' : 'Error creating product');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/admin/products')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Products
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {id ? 'Edit Product' : 'New Product'}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 relative rounded-lg overflow-hidden bg-gray-100">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Product preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Upload className="h-8 w-8" />
                  </div>
                )}
              </div>
              <label className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('photo-upload')?.click()}
                >
                  {photoPreview ? 'Change Photo' : 'Upload Photo'}
                </Button>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Product Name
              </label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData(prevData => ({ ...prevData, name: e.target.value }))}
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prevData => ({ ...prevData, description: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                  Price (RM)
                </label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData(prevData => ({ ...prevData, price: parseFloat(e.target.value) || 0 }))}
                />
              </div>

              <div>
                <label htmlFor="stock" className="block text-sm font-medium text-gray-700">
                  Stock
                </label>
                <Input
                  id="stock"
                  type="number"
                  required
                  value={formData.stock}
                  onChange={(e) => setFormData(prevData => ({ ...prevData, stock: parseInt(e.target.value, 10) || 0 }))}
                />
                {formData.stock !== undefined && formData.stock < 0 && (
                  <p className="mt-1 text-sm text-red-600">
                    Warning: Negative stock indicates oversold items
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="active"
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData(prevData => ({ ...prevData, active: e.target.checked }))}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
              />
              <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
                Product is active
              </label>
            </div>

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/products')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {id ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  id ? 'Update Product' : 'Create Product'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}