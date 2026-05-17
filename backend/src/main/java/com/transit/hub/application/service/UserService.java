package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateUserRequest;
import com.transit.hub.application.dto.request.UpdateUserRequest;
import com.transit.hub.application.dto.response.PageResponse;
import com.transit.hub.application.dto.response.UserResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.exception.ValidationException;
import com.transit.hub.application.support.UnpaginatedCap;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public List<UserResponse> getAll() {
        return UnpaginatedCap.findAllCapped(userRepository, log, "UserService.getAll")
                .stream()
                .map(UserResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> getAll(String search, Pageable pageable) {
        Page<User> page;
        if (search != null && !search.isBlank()) {
            page = userRepository.findBySearch(search.trim(), pageable);
        } else {
            page = userRepository.findAll(pageable);
        }
        return PageResponse.from(page, UserResponse::from);
    }

    @Transactional(readOnly = true)
    public UserResponse getById(UUID id) {
        return userRepository.findById(id)
                .map(UserResponse::from)
                .orElseThrow(() -> new EntityNotFoundException("User", id));
    }

    public UserResponse create(CreateUserRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw ValidationException.ofKey("error.user.usernameAlreadyExists");
        }

        User user = User.builder()
                .username(request.username())
                .password(passwordEncoder.encode(request.password()))
                .role(request.role())
                .enabled(true)
                .build();

        return UserResponse.from(userRepository.save(user));
    }

    public UserResponse update(UUID id, UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("User", id));

        boolean wasActiveAdmin = user.getRole() == UserRole.ADMIN && user.isEnabled();
        boolean willBeActiveAdmin = request.role() == UserRole.ADMIN && request.enabled();
        if (wasActiveAdmin && !willBeActiveAdmin) {
            ensureAtLeastOneOtherActiveAdmin();
        }

        boolean passwordChanged = request.password() != null && !request.password().isBlank();
        boolean roleChanged = user.getRole() != request.role();
        boolean disabling = user.isEnabled() && !request.enabled();

        if (passwordChanged) {
            user.setPassword(passwordEncoder.encode(request.password()));
        }

        user.setRole(request.role());
        user.setEnabled(request.enabled());

        // Bump the access-token version whenever the change must take
        // effect before the existing JWT expires — password reset, role
        // change (privilege drift in either direction) and account
        // disable each warrant immediate revocation of any token already
        // out there.
        if (passwordChanged || roleChanged || disabling) {
            user.setTokenVersion(user.getTokenVersion() + 1);
        }

        return UserResponse.from(userRepository.save(user));
    }

    public void delete(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("User", id));

        // Self-delete locks the caller out of the system immediately,
        // even if another active admin still exists — the JWT becomes
        // invalid on the next /me lookup. The last-admin guard alone
        // is not enough because a two-admin org would still let either
        // one delete themselves and brick their own session.
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && user.getUsername().equals(auth.getName())) {
            throw ValidationException.ofKey("error.user.cannotDeleteSelf");
        }

        if (user.getRole() == UserRole.ADMIN && user.isEnabled()) {
            ensureAtLeastOneOtherActiveAdmin();
        }

        userRepository.deleteById(id);
    }

    private void ensureAtLeastOneOtherActiveAdmin() {
        long activeAdmins = userRepository.countByRoleAndEnabledTrue(UserRole.ADMIN);
        // The caller is still counted at this point — at least 2 are needed
        // for the change to leave someone else as active admin.
        if (activeAdmins <= 1) {
            throw ValidationException.ofKey("error.user.lastActiveAdmin");
        }
    }
}
