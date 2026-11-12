-- Fix the archive_user function to handle foreign key constraints
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

    -- Delete user roles first
    DELETE FROM user_roles WHERE user_id = p_user_id;

    -- Update audit_logs to set user_id to NULL for this user
    UPDATE audit_logs 
    SET user_id = NULL 
    WHERE user_id = p_user_id;

    -- Delete the user
    DELETE FROM users WHERE id = p_user_id;

    -- Log the archival (this will be the last reference to the user)
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
        (SELECT row_to_json(au) FROM archived_users au WHERE au.original_user_id = p_user_id),
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
