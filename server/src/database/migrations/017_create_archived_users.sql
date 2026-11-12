-- Create archived_users table
CREATE TABLE archived_users (
    id SERIAL PRIMARY KEY,
    original_user_id INTEGER NOT NULL,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255),
    mobile_number VARCHAR(20),
    employee_id VARCHAR(50),
    designation VARCHAR(100),
    date_of_birth DATE,
    status VARCHAR(50),
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    login_count INTEGER DEFAULT 0,
    approval_status VARCHAR(50),
    approved_at TIMESTAMP,
    approved_by INTEGER REFERENCES users(id),
    is_protected BOOLEAN DEFAULT false,
    is_superuser BOOLEAN DEFAULT false,
    created_at TIMESTAMP NOT NULL,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_by INTEGER REFERENCES users(id),
    archive_reason TEXT,
    metadata JSONB -- For any additional data we might want to store
);

-- Create index on original_user_id for faster lookups
CREATE INDEX idx_archived_users_original_user_id ON archived_users(original_user_id);

-- Create index on email for searching
CREATE INDEX idx_archived_users_email ON archived_users(email);

-- Create index on archived_at for filtering
CREATE INDEX idx_archived_users_archived_at ON archived_users(archived_at);

-- Create archived_user_roles table to store role history
CREATE TABLE archived_user_roles (
    id SERIAL PRIMARY KEY,
    archived_user_id INTEGER REFERENCES archived_users(id),
    original_user_id INTEGER NOT NULL,
    original_role_id INTEGER NOT NULL,
    department_id INTEGER,
    role_name VARCHAR(100),
    department_name VARCHAR(100),
    assigned_at TIMESTAMP,
    unassigned_at TIMESTAMP,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Create index on archived_user_id
CREATE INDEX idx_archived_user_roles_archived_user_id ON archived_user_roles(archived_user_id);

-- Create function to archive a user
CREATE OR REPLACE FUNCTION archive_user(
    p_user_id INTEGER,
    p_archived_by INTEGER,
    p_archive_reason TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_archived_user_id INTEGER;
BEGIN
    -- Insert into archived_users
    INSERT INTO archived_users (
        original_user_id,
        email,
        username,
        first_name,
        last_name,
        full_name,
        mobile_number,
        employee_id,
        designation,
        date_of_birth,
        status,
        email_verified,
        last_login,
        login_count,
        approval_status,
        approved_at,
        approved_by,
        is_protected,
        is_superuser,
        created_at,
        archived_by,
        archive_reason,
        metadata
    )
    SELECT 
        id,
        email,
        username,
        first_name,
        last_name,
        full_name,
        mobile_number,
        employee_id,
        designation,
        date_of_birth,
        status,
        email_verified,
        last_login,
        login_count,
        approval_status,
        approved_at,
        approved_by,
        is_protected,
        is_superuser,
        created_at,
        p_archived_by,
        p_archive_reason,
        jsonb_build_object(
            'last_known_state', row_to_json(u)::jsonb
        )
    FROM users u
    WHERE id = p_user_id
    RETURNING id INTO v_archived_user_id;

    -- Archive user roles
    INSERT INTO archived_user_roles (
        archived_user_id,
        original_user_id,
        original_role_id,
        department_id,
        role_name,
        department_name,
        assigned_at,
        unassigned_at,
        metadata
    )
    SELECT 
        v_archived_user_id,
        ur.user_id,
        ur.role_id,
        r.department_id,
        r.name as role_name,
        d.name as department_name,
        ur.assigned_at,
        ur.unassigned_at,
        jsonb_build_object(
            'last_known_state', row_to_json(ur)::jsonb
        )
    FROM user_roles ur
    LEFT JOIN roles r ON ur.role_id = r.id
    LEFT JOIN departments d ON r.department_id = d.id
    WHERE ur.user_id = p_user_id;

    -- Delete user roles
    DELETE FROM user_roles WHERE user_id = p_user_id;

    -- Delete the user
    DELETE FROM users WHERE id = p_user_id;

    -- Log the archival
    INSERT INTO audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        old_values,
        metadata,
        description,
        ip_address
    )
    VALUES (
        p_archived_by,
        'user_archived',
        'users',
        p_user_id,
        (SELECT row_to_json(u) FROM users u WHERE id = p_user_id),
        jsonb_build_object(
            'archived_user_id', v_archived_user_id,
            'archive_reason', p_archive_reason
        ),
        'User archived and deleted from system',
        '127.0.0.1'
    );

    RETURN v_archived_user_id;
END;
$$ LANGUAGE plpgsql;
