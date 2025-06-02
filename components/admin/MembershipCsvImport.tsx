import React, { useState, useCallback, useMemo, ChangeEvent } from 'react';
import Papa, { ParseResult, ParseError } from 'papaparse';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { Input as UiInput } from '../ui/input';
import { Loader2, AlertTriangle, CheckCircle, RefreshCw, Edit3, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { Member } from '../../types';

const CSV_COLUMN_MAP: { [key: string]: keyof ParsedRowData } = {
  'member_id': 'member_id',
  'name': 'name',
  'email': 'email',
  'phone': 'phone',
  'nric': 'nric',
  'type': 'type',
  'status': 'status',
  'photo_url': 'photo_url',
  'expiry_date': 'expiry_date',
  'created_at': 'created_at_custom',
};

const EDITABLE_CSV_HEADERS: Array<keyof CsvRow> = ['member_id', 'name', 'email', 'phone', 'nric', 'type', 'status', 'expiry_date'];

type ExpectedMemberFields = Omit<Member, 'id'>;

interface CsvRow {
  member_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  nric?: string;
  type?: string;
  status?: string;
  photo_url?: string;
  expiry_date?: string;
  created_at?: string;
  [key: string]: string | undefined;
}

interface ParsedRowData {
    member_id?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    nric?: string | null;
    type?: string | null;
    status?: string | null;
    photo_url?: string | null;
    expiry_date?: string | null;
    created_at_custom?: string | null;
    [key: string]: any;
}

interface MemberUpsertPayload extends Partial<Omit<Member, 'id'>> {
    created_at?: string;
}

export const MembershipCsvImport: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRowData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [overlappingMemberIds, setOverlappingMemberIds] = useState<string[]>([]);
  const [showOverlapConfirmation, setShowOverlapConfirmation] = useState(false);

  // New state for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50; // Configurable: how many items per page

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccessMessage(null);
    setParsedData([]);
    setHeaders([]);
    setOverlappingMemberIds([]);
    setShowOverlapConfirmation(false);
    setCurrentPage(1); // Reset to first page on new file upload
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Invalid file type. Please upload a .csv file.');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      parseCsvAndCheckOverlaps(selectedFile);
    } else {
      setFile(null);
    }
  };

  const processRawCsvRow = (rawRow: CsvRow, allHeaders: string[]): ParsedRowData => {
    const memberRecord: ParsedRowData = {};
    for (const csvHeader of allHeaders) {
      const targetKeyInParsedData = CSV_COLUMN_MAP[csvHeader] || csvHeader;
      let value: string | null | undefined = rawRow[csvHeader];

      if (value === '' || value?.toUpperCase() === 'NULL') {
        value = null;
      }

      if ((targetKeyInParsedData === 'expiry_date' || targetKeyInParsedData === 'created_at_custom') && value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
           // console.warn(`Invalid date format for ${csvHeader}: ${value}. Expected YYYY-MM-DD`);
        }
      }
      memberRecord[targetKeyInParsedData] = value;
    }
    return memberRecord;
  };

  const parseCsvAndCheckOverlaps = useCallback(async (csvFile: File) => {
    setIsLoading(true);
    setError(null);
    setOverlappingMemberIds([]);

    Papa.parse<CsvRow>(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: ParseResult<CsvRow>) => {
        if (results.errors.length > 0) {
          console.error("CSV Parsing errors:", results.errors);
          setError(`Error parsing CSV: ${results.errors.map((e: ParseError) => e.message).join(', ')}`);
          setIsLoading(false);
          setParsedData([]);
          setHeaders([]);
          return;
        }
        
        const data = results.data;
        const detectedHeaders = results.meta.fields || [];
        setHeaders(detectedHeaders);

        const processedData = data.map(row => processRawCsvRow(row, detectedHeaders));
        setParsedData(processedData);

        const csvMemberIds = processedData
          .map(record => record.member_id)
          .filter(id => id != null && id !== '') as string[];

        if (csvMemberIds.length > 0) {
          try {
            const { data: existingMembers, error: fetchError } = await supabase
              .from('members')
              .select('member_id')
              .in('member_id', csvMemberIds);

            if (fetchError) throw fetchError;
            if (existingMembers) {
              setOverlappingMemberIds(existingMembers.map(m => m.member_id));
            }
          } catch (e: any) {
            console.error("Error fetching existing member IDs:", e);
            setError("Could not verify existing members. Please try again.");
          }
        }
        setIsLoading(false);
      },
      error: (err: Error) => {
        console.error("CSV Parsing Papaparse error:", err);
        setError(`Error parsing CSV: ${err.message}`);
        setIsLoading(false);
        setParsedData([]);
        setHeaders([]);
      }
    });
  }, []);

  const handleCellChange = (originalRowIndex: number, columnKeyInParsedData: keyof ParsedRowData, value: string) => {
    const updatedData = parsedData.map((row, idx) => {
      if (idx === originalRowIndex) {
        return { ...row, [columnKeyInParsedData]: value === '' ? null : value };
      }
      return row;
    });
    setParsedData(updatedData);
    
    if (columnKeyInParsedData === 'member_id') {
        // This simplified approach means if a user types a NEW ID that IS an overlap, the UI won't immediately reflect it
        // until a full re-parse/re-check. The current visual only reflects overlaps from initial CSV load.
        // However, the final submission logic (recordsToUpsert) will use the current ID.
    }
  };

  const recordsToUpsert = useMemo((): MemberUpsertPayload[] => {
    return parsedData
      .map(item => {
        const record: MemberUpsertPayload = {};
        let hasRequiredBaseFields = true;

        for (const csvHeader in CSV_COLUMN_MAP) {
            const parsedDataKey = CSV_COLUMN_MAP[csvHeader];
            const supabaseMemberKey = parsedDataKey === 'created_at_custom' 
                ? 'created_at' 
                : parsedDataKey as keyof Omit<Member, 'id'>;

            if (item[parsedDataKey] !== undefined) {
                (record as any)[supabaseMemberKey] = item[parsedDataKey] === '' ? null : item[parsedDataKey];
            }
        }

        if (!record.name || !record.member_id) {
          hasRequiredBaseFields = false;
        }
        return hasRequiredBaseFields ? record : null;
      })
      .filter(record => record !== null) as MemberUpsertPayload[];
  }, [parsedData]);

  const newRecordsCount = useMemo(() => {
    return recordsToUpsert.filter(r => r.member_id && !overlappingMemberIds.includes(r.member_id)).length;
  }, [recordsToUpsert, overlappingMemberIds]);

  const updatingRecordsCount = useMemo(() => {
    return recordsToUpsert.filter(r => r.member_id && overlappingMemberIds.includes(r.member_id)).length;
  }, [recordsToUpsert, overlappingMemberIds]);

  const executeSupabaseUpsert = async () => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    setShowOverlapConfirmation(false); 

    try {
      const { error: supaError } = await supabase
        .from('members')
        .upsert(recordsToUpsert, { onConflict: 'member_id' });

      if (supaError) {
        throw supaError;
      }

      let successMsg = `Successfully processed ${recordsToUpsert.length} records.`;
      if (newRecordsCount > 0) successMsg += ` ${newRecordsCount} new members added.`;
      if (updatingRecordsCount > 0) successMsg += ` ${updatingRecordsCount} existing members updated.`;
      
      setSuccessMessage(successMsg);
      toast.success(successMsg, { duration: 4000 });
      setFile(null);
      setParsedData([]);
      setHeaders([]);
      setOverlappingMemberIds([]);
    } catch (e: any) {
      console.error('Error submitting to Supabase:', e);
      const errorMessage = e.message || 'An unknown error occurred.';
      setError(`Error submitting data: ${errorMessage}`);
      toast.error(`Error submitting data: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleSubmitReview = () => {
    if (recordsToUpsert.length === 0) {
      if (parsedData.length > 0 && parsedData.some(p => !p.member_id || !p.name)) {
        setError("Some records are missing Member ID or Name. Please correct them in the table.");
      } else if (parsedData.length > 0) {
        setError("No valid records to submit after filtering. Please check data.");
      } else {
        setError('No data to submit.');
      }
      return;
    }

    if (updatingRecordsCount > 0) {
      setShowOverlapConfirmation(true); 
    } else {
      executeSupabaseUpsert(); 
    }
  };

  // Calculate data for the current page
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return parsedData.slice(startIndex, endIndex);
  }, [parsedData, currentPage, ITEMS_PER_PAGE]);

  const totalPages = useMemo(() => {
    return Math.ceil(parsedData.length / ITEMS_PER_PAGE);
  }, [parsedData.length, ITEMS_PER_PAGE]);

  const getColumnValueDisplay = (row: ParsedRowData, originalRowIndex: number, csvHeader: string): React.ReactNode => {
    const keyInParsedData = CSV_COLUMN_MAP[csvHeader] || csvHeader;
    const value = row[keyInParsedData];
    
    const isEditable = EDITABLE_CSV_HEADERS.includes(csvHeader as keyof CsvRow);
    const isMandatoryMissing = (keyInParsedData === 'member_id' || keyInParsedData === 'name') && (value === null || value === undefined || value === '');

    if (isEditable) {
      return (
        <input
          type="text"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleCellChange(originalRowIndex, keyInParsedData as keyof ParsedRowData, e.target.value)}
          className={`w-full px-1 py-0.5 border rounded-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-sm ${isMandatoryMissing ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
        />
      );
    }
    
    if (value === null || value === undefined) return <span className="text-gray-400 italic">NULL</span>;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    
    const isOverlapping = keyInParsedData === 'member_id' && typeof value === 'string' && overlappingMemberIds.includes(value);
    if (isOverlapping) {
      return (
        <span className="flex items-center">
          {String(value)}
          <RefreshCw className="h-3 w-3 ml-1.5 text-blue-500" />
        </span>
      );
    }
    return String(value);
  };

  const numValidRecords = recordsToUpsert.length;
  const numParsedRecords = parsedData.length;

  const OverlapConfirmationModal = () => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <div className="flex items-start">
          <div className="mr-3 flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:h-10 sm:w-10">
            <AlertTriangle className="h-6 w-6 text-yellow-500" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
              Confirm Overwrite
            </h3>
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                Your CSV file contains <strong className="text-gray-700">{updatingRecordsCount}</strong> record(s) that will <strong className="text-yellow-600">update existing members</strong> because their Member IDs match.
              </p>
              {newRecordsCount > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Additionally, <strong className="text-gray-700">{newRecordsCount}</strong> record(s) will be imported as <strong className="text-green-600">new members</strong>.
                </p>
              )}
              <p className="text-sm text-gray-500 mt-3">
                Are you sure you want to proceed?
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <Button
            onClick={executeSupabaseUpsert}
            disabled={isSubmitting}
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-orange-600 text-base font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 sm:ml-3 sm:w-auto sm:text-sm"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Yes, Proceed with Updates'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowOverlapConfirmation(false)}
            disabled={isSubmitting}
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6 bg-white shadow rounded-lg">
      <h2 className="text-xl font-semibold text-gray-800 border-b pb-3">Import Members from CSV</h2>
      
      <div>
        <label htmlFor="csv-upload" className="block text-sm font-medium text-gray-700 mb-1">
          Upload CSV File
        </label>
        <div className="flex items-center space-x-2">
          <UiInput
            id="csv-upload"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="max-w-xs file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100 disabled:opacity-50"
            disabled={isLoading || isSubmitting}
          />
          {(isLoading && !isSubmitting) && <Loader2 className="h-5 w-5 animate-spin text-orange-500" />}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Map CSV columns like: {Object.keys(CSV_COLUMN_MAP).join(', ')}. Editable fields are marked. Red border for missing required fields.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-md text-red-700 flex items-start shadow-sm">
          <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Import Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
      {successMessage && (
         <div className="p-3 bg-green-50 border border-green-300 rounded-md text-green-700 flex items-start shadow-sm">
          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Import Successful</p>
            <p className="text-sm">{successMessage}</p>
          </div>
        </div>
      )}

      {numParsedRecords > 0 && !error && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-800">
            Review and Edit Data ({numParsedRecords} records found, {numValidRecords} valid for import)
            {updatingRecordsCount > 0 && 
              <span className="ml-2 text-sm font-normal text-yellow-600">({updatingRecordsCount} will update existing)</span>}
            {numParsedRecords > numValidRecords && 
                <span className="ml-2 text-sm font-normal text-red-600">({numParsedRecords - numValidRecords} invalid - check red fields)</span>}
          </h3>
           <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  {headers.map((header) => (
                    <th
                      key={header}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                    >
                      {header.replace(/_/g, ' ')}
                      {EDITABLE_CSV_HEADERS.includes(header as keyof CsvRow) && <Edit3 className="h-3 w-3 inline-block ml-1 text-gray-400" />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.map((row, pageSpecificIndex) => {
                  // Calculate the original index in the full parsedData array
                  const originalRowIndex = (currentPage - 1) * ITEMS_PER_PAGE + pageSpecificIndex;
                  return (
                    <tr key={originalRowIndex} className={`hover:bg-gray-50 ${originalRowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${row.member_id && typeof row.member_id === 'string' && overlappingMemberIds.includes(row.member_id) ? 'bg-yellow-50 hover:bg-yellow-100' : '' }`}>
                      {headers.map((header, cellIndex) => (
                        <td key={cellIndex} className="px-1 py-1 whitespace-nowrap text-sm text-gray-700 align-top">
                          {getColumnValueDisplay(row, originalRowIndex, header)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */} 
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3">
              <div>
                <p className="text-sm text-gray-700">
                  Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
                  <span className="ml-2">| Total Records: <span className="font-medium">{parsedData.length}</span></span>
                </p>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1 || isLoading || isSubmitting}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || isLoading || isSubmitting}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSubmitReview}
              disabled={isSubmitting || isLoading || numValidRecords === 0}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                `Confirm and Submit ${numValidRecords} Record${numValidRecords === 1 ? '' : 's'}`
              )}
            </Button>
          </div>
        </div>
      )}
      {showOverlapConfirmation && <OverlapConfirmationModal />}
    </div>
  );
}; 