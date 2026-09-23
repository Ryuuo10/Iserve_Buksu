# CLOUDINARY SETUP INSTRUCTIONS

## Overview
Cloudinary has been integrated into the grievance system for storing supporting files (PDFs, images, videos) uploaded by users.

## Step 1: Get Your Cloudinary Credentials

1. **Log in to your Cloudinary account** at https://cloudinary.com
   - You already have an account with cloud name: `dhpccow0j`

2. **Find your API Credentials:**
   - Go to your Dashboard (https://console.cloudinary.com/console/dashboard)
   - Look for "API Key" and "API Secret" in the dashboard
   - You'll see something like:
     ```
     Cloud Name: dhpccow0j
     API Key: 123456789012345
     API Secret: abcdefghijklmnopqrstuvwxyz123456
     ```

3. **Copy your credentials**

## Step 2: Update Backend Configuration

1. Open the file: `backend/.env`

2. Replace the placeholder values with your actual credentials:
   ```env
   CLOUDINARY_CLOUD_NAME=dhpccow0j
   CLOUDINARY_API_KEY=YOUR_ACTUAL_API_KEY_HERE
   CLOUDINARY_API_SECRET=YOUR_ACTUAL_API_SECRET_HERE
   ```

   Example:
   ```env
   CLOUDINARY_CLOUD_NAME=dhpccow0j
   CLOUDINARY_API_KEY=123456789012345
   CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxy123456
   ```

## Step 3: Restart the Backend Server

1. Stop the backend server if it's running (Ctrl+C)
2. Start it again:
   ```bash
   cd backend
   npm run dev
   ```

3. You should see no errors related to Cloudinary configuration

## Step 4: Test the Integration

1. Go to the frontend application
2. Start filing a grievance
3. When you reach the submission modal, click "Yes, Attach Files"
4. Upload some test files (PDF, JPEG, MP4, etc.)
5. Submit the grievance
6. Check the chat response - you should see:
   ```
   ⏳ Uploading your files to secure storage...
   ✅ Your grievance has been submitted successfully!
   
   📎 Files uploaded to Cloudinary:
   • filename.pdf
   • image.jpg
   ```

## File Storage Details

- **Folder Structure**: All files are stored in a folder called "grievances" in your Cloudinary account
- **Supported Formats**: PDF, JPEG, JPG, PNG, MP4, AVI, MOV
- **File Size Limit**: 10MB per file
- **Maximum Files**: 10 files per submission

## Viewing Uploaded Files

You can view all uploaded files in your Cloudinary dashboard:
1. Go to https://console.cloudinary.com/console/media_library
2. Navigate to the "grievances" folder
3. All submitted files will be there with their original filenames

## Security Notes

- Never commit your `.env` file to version control
- Keep your API Secret confidential
- The `.env` file is already in `.gitignore`, but double-check it's not committed

## Troubleshooting

### Error: "Cloudinary upload failed"
- Check that your API credentials are correct in `.env`
- Make sure the backend server is restarted after changing credentials
- Verify your Cloudinary account is active

### Error: "File too large"
- Files must be under 10MB each
- Compress large files before uploading

### Error: "Invalid file type"
- Only PDF, JPEG, JPG, PNG, MP4, AVI, and MOV files are allowed
- Convert files to supported formats before uploading

## Next Steps

Consider implementing:
- File preview in the admin dashboard
- Download links for uploaded files
- Automatic cleanup of old files
- Virus scanning for uploaded files
